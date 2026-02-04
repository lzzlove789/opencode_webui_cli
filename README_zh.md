OpenCode Web UI（CLI 包）
=========================

OpenCode CLI 的 Web UI 封装。

功能
----
- 支持流式回复的聊天界面
- 生成文件列表与预览
- 会话历史查看
- 通过 CLI 参数选择模型

安装
----
```bash
npm i -g opencode_webui_cli
```

使用
----
```bash
opencode-webui 
```

参数
----
- `-p, --port <port>`：监听端口（默认：8080）
- `--host <host>`：绑定地址（默认：127.0.0.1）
- `--opencode-path <path>`：opencode 可执行文件路径
- `--opencode-model <model>`：opencode CLI 默认模型
- `-d, --debug`：启用调试模式

功能截图
----

1) 项目展示
![项目展示](docs/images/project_display.png)

1) 新建项目
![新建项目](docs/images/create_new_project.png)

1) 新对话
![新对话](docs/images/empty-state.png)

1) Plan 模式
![Plan 模式](docs/images/Plan.png)

1) Build 模式
![Build 模式](docs/images/Build.png)

1) 模型选择
![模型选择](docs/images/models.png)

1) 模型连接
![模型连接](docs/images/connect.png)

1) 历史记录
![历史记录](docs/images/history.png)


致谢
----
本项目参考了以下开源项目：
- https://github.com/anomalyco/opencode
- https://github.com/sugyan/claude-code-webui

许可证
------
Apache-2.0
