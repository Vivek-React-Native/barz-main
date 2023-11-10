#!/bin/bash

OUT_DIR="src/ui/icons"

if [ -z "$FIGMA_TOKEN" ]; then
  FIGMA_TOKEN="$(cat .figma-token)"
fi
if [ -z "$FIGMA_TOKEN" ]; then
  printf "Enter Figma personal access token: "; read FIGMA_TOKEN
fi

# Step 1: Download icons from figma
cat <<EOF > icons-config.json
{
  "figmaPersonalToken": "$FIGMA_TOKEN",
  "fileId": "Lm0qLCM7JsbtjNGVupjq3u",
  "page": "🚏 Iconography",
  "frame": "icons",
  "iconsPath": ".fetched-icons",
  "removeFromName": ""
}
EOF
npx figma-export-icons 

echo "Deleting Frame 16..."
rm -rf ".fetched-icons/Frame 16.svg"

# Step 2: Convert those icons into React components using react-native-svg
# More info: https://react-svgr.com/docs/custom-templates/
cat <<EOF > icon-template.js
module.exports = (variables, { tpl }) => {
  // Remove "xmlns" attribute, this is not valid according to the react-native-svg typescript definitions
  variables.jsx.openingElement.attributes = variables.jsx.openingElement.attributes.filter(a => {
    return a.name.name !== 'xmlns';
  });

  // Remove "import type" imports - these are importing duplicative data that the previous regular
  // imports are already importing
  variables.imports = variables.imports.filter(a => {
    return a.importKind !== 'type';
  });

  return tpl\`
\${variables.imports};

\${variables.interfaces};

type IconProps = {
  size?: number;
  color?: string;
}

const \${variables.componentName} = (iconProps: IconProps) => {
  const props = {};
  return (
    \${variables.jsx}
  );
};

\${variables.exports};
\`
}
EOF

cat <<EOF > index-icon-template.js
const path = require('path');

function defaultIndexTemplate(filePaths) {
  let defaultExportLines = [];
  const exportEntries = filePaths.map(({ path: filePath }) => {
    const basename = path.basename(filePath, path.extname(filePath));
    const exportName = /^\\d/.test(basename) ? \`Svg\${basename}\` : basename;
    defaultExportLines.push(exportName);
    return \`
    import \${exportName} from './\${basename}';
    export { \${exportName} };
    \`
  })
  return \`
  \${exportEntries.join('\\n')}
  export default {
    \${defaultExportLines.join(',\n')}
  };
  \`;
}

module.exports = defaultIndexTemplate
EOF

npx @svgr/cli \
  --typescript \
  --template icon-template.js \
  --index-template index-icon-template.js \
  --native \
  --replace-attr-values "#fff={iconProps.color || 'white'}" \
  --svg-props width="{iconProps.size || 24}" \
  --svg-props height="{iconProps.size || 24}" \
  --svg-props viewBox="0 0 24 24" \
  --out-dir $OUT_DIR \
  .fetched-icons
