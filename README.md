OpenCode Web UI (CLI Package)
=============================
[English](./README.md) | [中文](./README_zh.md)

A Web UI wrapper for the OpenCode CLI.

Features
--------
- Chat interface with streaming responses
- Generated files panel with preview
- Conversation history viewer
- Model selection via CLI flag

Install
-------
```bash
npm i -g opencode_webui_cli
```

Usage
-----
```bash
opencode-webui
```

Options
-------
- `-p, --port <port>`: Port to listen on (default: 8080)
- `--host <host>`: Host address to bind to (default: 127.0.0.1)
- `--opencode-path <path>`: Path to opencode executable
- `--opencode-model <model>`: Default model for opencode CLI
- `-d, --debug`: Enable debug mode

Screenshots
-----------

1) Display project
![Display project](docs/images/project_display.png)

1) create project
![create project](docs/images/create_new_project.png)

1) Empty state
![Empty state](docs/images/empty-state.png)

1) Plan mode
![Plan mode](docs/images/Plan.png)

1) Build mode
![Build mode](docs/images/Build.png)

1) Model selection
![Model selection](docs/images/models.png)

1) Model connect
![Model connect](docs/images/connect.png)

1) History with Chat
![History with Chat](docs/images/history.png)

Credits
-------
This project is based on and inspired by:
- https://github.com/anomalyco/opencode
- https://github.com/sugyan/claude-code-webui

License
-------
Apache-2.0
