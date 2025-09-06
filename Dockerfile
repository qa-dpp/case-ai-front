# 第一阶段：构建阶段
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 先复制package.json和package-lock.json以利用Docker缓存
COPY package*.json ./

# 配置npm使用阿里云镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 安装依赖
RUN npm install

# 复制项目源代码
COPY . .

# 构建项目
RUN npm run build

# 第二阶段：运行阶段
FROM nginx:alpine

# 复制nginx配置文件
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制自定义的nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露80端口
EXPOSE 80

# 启动nginx服务
CMD ["nginx", "-g", "daemon off;"]