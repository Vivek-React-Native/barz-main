const puppeteer = require('puppeteer');
const delay = require('./delay');

const MockSMSReceiver = {
  async generatePhoneNumberToReceiveSMSMessage(onPhoneNumberReceived, blockedPhoneNumbers = []) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // NOTE: This "quackr" service is something I found online that is a disposible phone number
    // sort of service. Using this allows the sms code sending tests to be fully end to end - the
    // SMS codes can be received and processed, without having to mock out clerk.
    await page.goto('https://quackr.io/temporary-numbers/united-states');

    // Get the first phone number available for testing
    let phoneNumberLinkSelector, phoneNumber;
    for (let i = 1; true; i += 1) {
      phoneNumberLinkSelector = await page.waitForSelector(`div:nth-child(${i}) number-card a`);
      if (!phoneNumberLinkSelector) {
        throw new Error(`Unable to find phone number of index ${i}!`);
      }
      phoneNumber = await phoneNumberLinkSelector?.evaluate((el) => el.textContent);
      if (!blockedPhoneNumbers.includes(phoneNumber)) {
        break;
      }
    }

    // Click the selected phone number
    await phoneNumberLinkSelector.click();

    // Wait for the table of messages to show up
    // NOTE: sometimes this fails on the first try, so refresh the page if need be to give it
    // another shot to find the elements
    try {
      await page.waitForSelector('table tr td', { timeout: 10_000 });
    } catch {
      await page.reload();
      await page.waitForSelector('table tr td');
    }

    // Store the message that was at the top of the table of previously sent messages, so that
    // later on, it can be determined if new messages show up
    const getAllMessagesInTable = async () => {
      const cells = await page.mainFrame().$$('table tr td:last-child');
      return Promise.all(cells.map((cell) => cell.evaluate((el) => el.textContent)));
    };
    const result = await getAllMessagesInTable();
    let mostRecentlySentMessage = result.length > 0 ? result[0] : '';

    const waitForSMSMessageToBeReceived = async (
      messageFilter = () => true,
      delayBetweenPollsInMilliseconds = 100,
    ) => {
      return new Promise(async (resolve) => {
        while (true) {
          const allMessages = await getAllMessagesInTable();
          const lastMessageIndex = allMessages.indexOf(mostRecentlySentMessage);
          const newMessages = allMessages.slice(0, lastMessageIndex);

          mostRecentlySentMessage = allMessages[0];

          for (const newMessage of newMessages) {
            if (messageFilter(newMessage)) {
              resolve(newMessage);
              return;
            }
          }

          await delay(delayBetweenPollsInMilliseconds);
        }
      });
    };

    await onPhoneNumberReceived(phoneNumber, waitForSMSMessageToBeReceived);

    // Once the message has been received, terminate the browser session
    await browser.close();
  },
};

module.exports = MockSMSReceiver;
