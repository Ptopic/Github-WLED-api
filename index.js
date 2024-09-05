const express = require('express');
const axios = require('axios');

require('dotenv').config();

const app = express();
const port = 3000;

app.get('/check-merge/:organization/:repo/:prId', async (req, res) => {
	const { organization, repo, prId } = req.params;
	const githubToken = process.env.GITHUB_TOKEN;
	const haToken = process.env.HA_TOKEN;
	const webhookUrl = process.env.PR_MERGED_WEBHOOK;

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
			try {
				await axios.post(webhookUrl, {
					headers: {
						Authorization: `Bearer ${haToken}`,
					},
				});
				res
					.status(200)
					.json({ stop: true, message: 'PR merged, webhook triggered.' });
			} catch (error) {
				res.status(500).json({
					stop: true,
					error: 'Failed to trigger Home Assistant webhook.',
				});
			}
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
			try {
				await axios.post(webhookUrl, {
					headers: {
						Authorization: `Bearer ${haToken}`,
					},
				});
				res.status(200).json({
					stop: true,
					message: 'Build failed, webhook triggered.',
				});
			} catch (error) {
				res.status(500).json({
					stop: true,
					error: 'Failed to trigger Home Assistant webhook.',
				});
			}
		} else if (lastCommitStatus === 'success') {
			try {
				await axios.post(webhookUrl, {
					headers: {
						Authorization: `Bearer ${haToken}`,
					},
				});
				res.status(200).json({
					stop: true,
					message: 'Build success, webhook triggered.',
				});
			} catch (error) {
				res.status(500).json({
					stop: true,
					error: 'Failed to trigger Home Assistant webhook.',
				});
			}
		} else {
			try {
				await axios.post(webhookUrl, {
					headers: {
						Authorization: `Bearer ${haToken}`,
					},
				});
				res.status(200).json({
					stop: false,
					message: 'Build pending, webhook triggered.',
				});
			} catch (error) {
				res.status(500).json({
					stop: true,
					error: 'Failed to trigger Home Assistant webhook.',
				});
			}
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
