// Convert a user-entered rapper name into an alphanumeric rapper handle
const generateHandleFromRapperName = (rapperName: string, index: number = 0) => {
  const name = rapperName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (index > 0) {
    return `${name}${index}`;
  } else {
    return name;
  }
};

export default generateHandleFromRapperName;
