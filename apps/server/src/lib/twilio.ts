import twilio from 'twilio';

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../config.ts';

export default twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
