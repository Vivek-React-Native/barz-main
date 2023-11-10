const path = require('path');
const fs = require('fs');

// Loads a json file fixture from the filesystem.
module.exports = async (fixturePath) => {
  const fixtureLocation = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.join(__dirname, '..', 'fixtures', fixturePath);
  const result = JSON.parse(fs.readFileSync(fixtureLocation).toString());
  return result;
};
