const express = require('express');
const axios = require('axios');
const { resetLights } = require('./utils');
const getUnResolvedCommentsQuery = require('./graphQlQueries');

require('dotenv').config();

const app = express();
const port = 3002;

app.get('/check-merge/:organization/:repo/:prId', async (req, res) => {
	const { organization, repo, prId } = req.params;
	const githubToken = process.env.GITHUB_TOKEN;
	const haToken = process.env.HA_TOKEN;
	const mergedWebhookUrl = process.env.PR_MERGED_WEBHOOK;

	try {
		const response = await axios.get(
			`https://api.github.com/repos/${organization}/${repo}/pulls/${prId}/merge`,
			{
				headers: {
					Authorization: `Bearer ${githubToken}`,
				},
			}
		);

		if (response.status === 204) {
			await axios.post(mergedWebhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});

			resetLights(30000);

			return res
				.status(200)
				.json({ stop: true, message: 'PR merged, webhook triggered.' });
		}
	} catch (error) {
		if (error.response && error.response.status !== 404) {
			return res
				.status(500)
				.json({ stop: true, error: 'Failed to check PR merge status.' });
		}
		return res.status(500).json({ stop: false, message: 'PR not merged.' });
	}
});

app.get('/check-comments/:organization/:repo/:prId', async (req, res) => {
	const { organization, repo, prId } = req.params;
	const githubToken = process.env.GITHUB_TOKEN;
	const haToken = process.env.HA_TOKEN;

	const mergedWebhookUrl = process.env.PR_MERGED_WEBHOOK;
	const newCommentsWebhookUrl = process.env.NEW_COMMENTS_WEBHOOK;

	try {
		// Check if PR is already merged
		const mergedResponse = await axios.get(
			`https://api.github.com/repos/${organization}/${repo}/pulls/${prId}/merge`,
			{
				headers: {
					Authorization: `Bearer ${githubToken}`,
				},
			}
		);

		if (mergedResponse.status === 204) {
			await axios.post(mergedWebhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});

			resetLights(30000);

			return res
				.status(200)
				.json({ stop: true, message: 'PR merged, returning...' });
		}
	} catch (error) {
		if (error.response && error.response.status !== 404) {
			return res.status(500).json({
				stop: true,
				error: 'Failed to fetch review comments from GitHub.',
			});
		} else {
			const variables = {
				organization,
				repo,
				prId: parseInt(prId, 10),
			};

			const response = await axios.post(
				'https://api.github.com/graphql',
				{
					query: getUnResolvedCommentsQuery,
					variables,
				},
				{
					headers: {
						Authorization: `Bearer ${githubToken}`,
						'Content-Type': 'application/json',
					},
				}
			);

			const reviewThreads =
				response.data.data.repository.pullRequest.reviewThreads.nodes;
			const unresolvedReviewComments = [];

			reviewThreads.forEach((thread) => {
				if (!thread.isResolved) {
					thread.comments.nodes.forEach((comment) => {
						if (comment.state === 'PENDING' || comment.state === 'SUBMITTED') {
							unresolvedReviewComments.push({
								author: comment.author.login,
								body: comment.body,
								state: comment.state,
							});
						}
					});
				}
			});

			if (unresolvedReviewComments.length > 0) {
				// return res.status(200).json({
				// 	stop: false,
				// 	message: unresolvedReviewComments,
				// });

				await axios.post(newCommentsWebhookUrl, {
					headers: {
						Authorization: `Bearer ${haToken}`,
					},
				});

				resetLights(30000);

				return res.status(200).json({
					stop: false,
					message: 'Unresolved review comments found, webhook triggered.',
				});
			} else {
				return res.status(200).json({
					stop: true,
					message: 'No unresolved review comments found.',
				});
			}
		}
	}
});

app.get('/check-build/:organization/:repo/:prId', async (req, res) => {
	const { organization, repo, prId } = req.params;
	const githubToken = process.env.GITHUB_TOKEN;
	const haToken = process.env.HA_TOKEN;

	const buildSuccessWebhookUrl = process.env.BUILD_SUCCESS_WEBHOOK;
	const buildFailureWebhookUrl = process.env.BUILD_FAILURE_WEBHOOK;
	const buildInProgressWebhookUrl = process.env.BUILD_IN_PROGRESS_WEBHOOK;

	try {
		const response = await axios.get(
			`https://api.github.com/repos/${organization}/${repo}/pulls/${prId}/commits`,
			{
				headers: {
					Authorization: `Bearer ${githubToken}`,
				},
			}
		);

		const commits = response.data;

		const lastCommit = commits[commits.length - 1];

		const lastCommitSha = lastCommit.sha;

		const commitStatusResponse = await axios.get(
			`https://api.github.com/repos/${organization}/${repo}/commits/${lastCommitSha}/status`,
			{
				headers: {
					Authorization: `Bearer ${githubToken}`,
				},
			}
		);

		// failure, pending, success
		const lastCommitStatus = commitStatusResponse.data.state;

		if (lastCommitStatus === 'failure') {
			await axios.post(buildFailureWebhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});

			resetLights(25000);

			return res.status(200).json({
				stop: true,
				message: 'Build failed, webhook triggered.',
			});
		} else if (lastCommitStatus === 'success') {
			await axios.post(buildSuccessWebhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});

			resetLights(25000);

			return res.status(200).json({
				stop: true,
				message: 'Build success, webhook triggered.',
			});
		} else {
			await axios.post(buildInProgressWebhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});

			resetLights(25000);

			return res.status(200).json({
				stop: false,
				message: 'Build pending, webhook triggered.',
			});
		}
	} catch (error) {
		return res
			.status(500)
			.json({ stop: true, error: 'Failed to check PR build status.' });
	}
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
