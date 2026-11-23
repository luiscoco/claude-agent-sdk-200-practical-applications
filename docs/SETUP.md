# Setup and troubleshooting

Use Node.js 24+ and Git for Node applications. Choose one folder under apps/, run npm ci there, and follow its README. Python-only projects use their pinned requirements files, not npm. Use Python 3.12+ and a virtual environment; Windows uses .venv/Scripts/python.exe and macOS/Linux use .venv/bin/python.

Applications need permission to create their owned run directories and start SDK subprocesses. On another OS or CPU architecture, install dependencies there instead of copying node_modules from another machine.

Configure credentials only in your own local environment. Never commit .env, private-key files, cloud credential JSON or exported session state. AWS, Google Cloud and Microsoft Foundry examples need their provider-specific identity, region and model configuration; a direct Anthropic API key does not replace those requirements.

Port in use: set PORT locally where the lesson supports it. Missing native executable: reinstall with npm ci and allow optional platform dependencies. Missing Python: use the lesson's interpreter setting; prompt 197 accepts LAB_PYTHON. Prompt 187 requires installed Chrome or an adapted Playwright channel. A backend server is required; GitHub Pages hosts only static content.

Keep lockfiles when reproducing examples. Check the installed SDK and runtime versions before adopting options from newer documentation. These are local educational servers; use an appropriate hosting and isolation design before exposing an agent publicly.
