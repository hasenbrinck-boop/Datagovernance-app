# Build Environment Setup

## Node.js Version Requirement

**Important:** SharePoint Framework 1.18.2 requires specific Node.js versions:
- Node.js 16.13.0 to <17.0.0
- **OR** Node.js 18.17.1 to <19.0.0

The current environment has Node.js v20.19.5 which is not compatible.

## Setup Options

### Option 1: Local Development (Recommended)

1. **Install Node Version Manager (nvm)**:
   ```bash
   # Windows
   Download and install nvm-windows from:
   https://github.com/coreybutler/nvm-windows/releases

   # macOS/Linux
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   ```

2. **Install Node.js 18**:
   ```bash
   nvm install 18.17.1
   nvm use 18.17.1
   node --version  # Should show v18.17.1
   ```

3. **Install Dependencies and Build**:
   ```bash
   cd datagovernance-spfx
   npm install
   npm run build
   npm run ship
   ```

### Option 2: Docker Build (Cross-Platform)

Use the provided Dockerfile to build in an isolated environment:

```bash
cd datagovernance-spfx

# Build the Docker image
docker build -t spfx-builder .

# Run the build
docker run --rm -v $(pwd):/workspace spfx-builder

# Output will be in ./sharepoint/solution/
```

### Option 3: GitHub Actions / CI/CD

The project includes a GitHub Actions workflow that automatically builds with the correct Node.js version.

See `.github/workflows/build-spfx.yml`

## Verification

After successful build, you should see:
- `./dist/` directory with compiled JavaScript
- `./lib/` directory with TypeScript output
- `./sharepoint/solution/*.sppkg` package file

## Deployment

Once built successfully:
1. Navigate to SharePoint Admin Center
2. Go to More Features > Apps > App Catalog
3. Upload the `.sppkg` file from `./sharepoint/solution/`
4. Check "Make this solution available to all sites"
5. Click Deploy

## Troubleshooting

### "Node version not supported" Error
- Make sure you're using Node.js 18.x: `node --version`
- If wrong version, use `nvm use 18` to switch

### "Cannot find module" Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Use `--legacy-peer-deps` flag if needed

### Build Errors
- Run `npm run clean` first
- Then try `npm run build` again
- Check that all TypeScript files have no syntax errors

### Gulp Errors
- Ensure global gulp is not installed: `npm uninstall -g gulp`
- SPFx uses local gulp from node_modules

## Alternative: SharePoint Framework Toolkit

You can also use the SharePoint Framework Toolkit VS Code extension which handles Node.js versions automatically:

1. Install Visual Studio Code
2. Install "SharePoint Framework Toolkit" extension
3. Open the project folder
4. Use the toolkit to build and deploy

## Support

For issues related to:
- **Node.js versions**: See [SPFx compatibility](https://learn.microsoft.com/sharepoint/dev/spfx/compatibility)
- **Build errors**: Check `./temp/build.log`
- **Deployment**: See SharePoint Admin documentation
