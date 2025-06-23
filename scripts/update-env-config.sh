#!/bin/bash

echo "==============================================="
echo "    HKGAI 模型配置更新脚本"
echo "==============================================="

# 配置文件地址
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "创建环境变量文件..."
  touch "$ENV_FILE"
fi

echo "更新 HKGAI 配置..."

# 备份当前环境变量
cp "$ENV_FILE" "${ENV_FILE}.backup"

# 检查是否需要更新/添加环境变量
update_env_var() {
  local key=$1
  local value=$2
  local description=$3
  
  if grep -q "^${key}=" "$ENV_FILE"; then
    # 变量已存在，更新其值
    sed -i.bak "s|^${key}=.*|${key}=${value} # ${description}|" "$ENV_FILE"
  else
    # 变量不存在，添加新变量
    echo "" >> "$ENV_FILE"
    echo "# ${description}" >> "$ENV_FILE"
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# 添加分隔符
echo "" >> "$ENV_FILE"
echo "# ===== HKGAI 模型配置 (更新于 $(date '+%Y-%m-%d %H:%M:%S')) =====" >> "$ENV_FILE"

# 更新基础配置
update_env_var "HKGAI_BASE_URL" "https://dify.hkgai.net" "普通HKGAI模型的基础URL"
update_env_var "HKGAI_RAG_BASE_URL" "https://ragpipeline.hkgai.asia" "RAG模型的基础URL"

# 更新API密钥
update_env_var "HKGAI_SEARCHENTRY_API_KEY" "app-mYHumURK2S010ZonuvzeX1Ad" "搜索入口模型API密钥"
update_env_var "HKGAI_MISSINGINFO_API_KEY" "app-cWHko7usG7aP8ZsAnSeglYc3" "缺失信息模型API密钥"
update_env_var "HKGAI_TIMELINE_API_KEY" "app-R9k11qz64Cd86NCsw2ojZVLC" "时间线模型API密钥"
update_env_var "HKGAI_GENERAL_API_KEY" "app-5PTDowg5Dn2MSEhG5n3FBWXs" "通用模型API密钥"
update_env_var "HKGAI_RAG_API_KEY" "sk-UgDQCBR58Fg66sb480Ff7f4003A740D8B7DcD97f3566BbAc" "RAG模型API密钥"

# 新增的Dify模型API密钥
update_env_var "HKGAI_CASE_SEARCH_API_KEY" "app-Fbs0YwuFNGHlhtAPPlvybrJm" "案例搜索模型API密钥"
update_env_var "HKGAI_CODE_SEARCH_API_KEY" "app-1rFXyZanlbQJdKtQTaZ3wuSS" "代码搜索模型API密钥"

# Dify模型的基础URL
update_env_var "HKGAI_DIFY_BASE_URL" "https://dify.hkgai.net" "Dify模型的基础URL"

echo "环境变量配置已更新！"
echo "备份文件已保存为 ${ENV_FILE}.backup"

# 提示重启服务
echo ""
echo "请重启服务以应用新的配置："
echo "docker-compose restart api"
echo "或"
echo "npm run dev"
echo ""

echo "===============================================" 