const express = require('express');
const axios = require('axios');

require('dotenv').config();

const app = express();
const port = 3002;

app.get('/check-merge/:organization/:repo/:prId', async (req, res) => {
	const { organization, repo, prId } = req.params;
	const githubToken = process.env.GITHUB_TOKEN;
	const haToken = process.env.HA_TOKEN;
	const webhookUrl = process.env.PR_MERGED_WEBHOOK;
	const resetLightsWebhookUrl = process.env.RESET_LIGHTS_WEBHOOK;

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
			await axios.post(webhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});

			setTimeout(async () => {
				await axios.post(resetLightsWebhookUrl, {
					headers: {
						Authorization: `Bearer ${haToken}`,
					},
				});
			}, 20000);

			res
				.status(200)
				.json({ stop: true, message: 'PR merged, webhook triggered.' });
		}
	} catch (error) {
		if (error.response && error.response.status !== 404) {
			res
				.status(500)
				.json({ stop: true, error: 'Failed to check PR merge status.' });
		}
		res.status(500).json({ stop: false, message: 'PR not merged.' });
	}
});

app.get('/check-comments/:organization/:repo/:prId', async (req, res) => {
	const { organization, repo, prId } = req.params;
	const githubToken = process.env.GITHUB_TOKEN;
	const haToken = process.env.HA_TOKEN;
});

app.get('/check-build/:organization/:repo/:prId', async (req, res) => {
	const { organization, repo, prId } = req.params;
	const githubToken = process.env.GITHUB_TOKEN;
	const haToken = process.env.HA_TOKEN;

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
			await axios.post(webhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});
			res.status(200).json({
				stop: true,
				message: 'Build failed, webhook triggered.',
			});
		} else if (lastCommitStatus === 'success') {
			await axios.post(webhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});
			res.status(200).json({
				stop: true,
				message: 'Build success, webhook triggered.',
			});
		} else {
			await axios.post(webhookUrl, {
				headers: {
					Authorization: `Bearer ${haToken}`,
				},
			});
			res.status(200).json({
				stop: false,
				message: 'Build pending, webhook triggered.',
			});
		}

		res.status(200).json({ stop: true, message: lastCommitStatus });
	} catch (error) {
		res
			.status(500)
			.json({ stop: true, error: 'Failed to check PR merge status.' });
	}
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
