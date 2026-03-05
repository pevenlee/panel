# Docker 部署说明

## 一键启动

```bash
docker-compose up --build
```

或双击运行 `start-docker.bat`

## 访问地址

- 前端: http://localhost:8080
- 后端: http://localhost:8001

## 停止服务

```bash
docker-compose down
```

## 注意事项

确保 `backend/.env` 文件存在并配置正确
