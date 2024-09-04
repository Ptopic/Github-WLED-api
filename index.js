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
				return res
					.status(200)
					.json({ stop: true, message: 'PR merged, webhook triggered.' });
			} catch (error) {
				console.error(
					'Error triggering Home Assistant webhook:',
					error.message
				);
				return res
					.status(500)
					.json({
						stop: true,
						error: 'Failed to trigger Home Assistant webhook.',
					});
			}
		}
	} catch (error) {
		if (error.response && error.response.status !== 404) {
			console.error('Error checking PR merge status:', error.message);
			return res
				.status(500)
				.json({ stop: true, error: 'Failed to check PR merge status.' });
		}
		return res.status(500).json({ stop: false, message: 'PR not merged.' });
	}
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
