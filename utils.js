const axios = require('axios');
require('dotenv').config();

const haToken = process.env.HA_TOKEN;
const resetLightsWebhookUrl = process.env.RESET_LIGHTS_WEBHOOK;

const resetLights = () => {
	setTimeout(async () => {
		await axios.post(resetLightsWebhookUrl, {
			headers: {
				Authorization: `Bearer ${haToken}`,
			},
		});
	}, 20000);
};

module.exports = { resetLights };
