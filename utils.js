const axios = require('axios');
require('dotenv').config();

const haToken = process.env.HA_TOKEN;
const resetLightsWebhookUrl = process.env.RESET_LIGHTS_WEBHOOK;

const resetLights = (delay) => {
	setTimeout(async () => {
		await axios.post(resetLightsWebhookUrl, {
			headers: {
				Authorization: `Bearer ${haToken}`,
			},
		});
	}, delay);
};

module.exports = { resetLights };
