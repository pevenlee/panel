"""
测试Gemini图片生成API的响应结构
"""
import os
import sys

# 添加app目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from google import genai
from google.genai import types

# 加载环境变量
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")

api_key = os.environ.get("GENAI_API_KEY", "").strip()
if not api_key:
    print("错误：未找到 GENAI_API_KEY")
    sys.exit(1)

print(f"API Key 已加载（前10字符）: {api_key[:10]}...")

# 初始化客户端
client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
print("Gemini 客户端初始化成功")

# 测试图片生成
image_prompt = """请生成一张医药数据分析的专业信息图"""

print(f"\n发送提示词: {image_prompt}")
print("调用 Gemini API...")

try:
    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=image_prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"]
        )
    )

    print(f"\n响应类型: {type(response)}")
    print(f"响应属性: {dir(response)}")

    # 检查 candidates
    candidates = getattr(response, 'candidates', None)
    print(f"\ncandidates: {candidates}")
    print(f"candidates 类型: {type(candidates)}")

    if candidates:
        print(f"candidates 数量: {len(candidates)}")

        for idx, candidate in enumerate(candidates):
            print(f"\n=== Candidate {idx} ===")
            print(f"类型: {type(candidate)}")
            print(f"属性: {dir(candidate)}")

            if hasattr(candidate, 'content'):
                content = candidate.content
                print(f"\nContent 类型: {type(content)}")
                print(f"Content 属性: {dir(content)}")

                if hasattr(content, 'parts'):
                    parts = content.parts
                    print(f"\nParts: {parts}")
                    print(f"Parts 类型: {type(parts)}")

                    if parts:
                        print(f"Parts 数量: {len(parts)}")

                        for part_idx, part in enumerate(parts):
                            print(f"\n--- Part {part_idx} ---")
                            print(f"类型: {type(part)}")
                            print(f"属性: {dir(part)}")

                            # 检查 inline_data
                            if hasattr(part, 'inline_data'):
                                inline_data = part.inline_data
                                print(f"\ninline_data: {inline_data}")
                                print(f"inline_data 类型: {type(inline_data)}")

                                if inline_data:
                                    print(f"inline_data 属性: {dir(inline_data)}")

                                    # 检查 data
                                    if hasattr(inline_data, 'data'):
                                        data = inline_data.data
                                        print(f"\ndata 类型: {type(data)}")
                                        if data:
                                            print(f"data 大小: {len(data)} 字节/字符")
                                            if isinstance(data, bytes):
                                                print(f"data 前16字节 (hex): {data[:16].hex()}")
                                        else:
                                            print("data 为 None 或空")

                                    # 检查 mime_type
                                    if hasattr(inline_data, 'mime_type'):
                                        print(f"mime_type: {inline_data.mime_type}")

                            # 检查 text
                            if hasattr(part, 'text'):
                                text = part.text
                                if text:
                                    print(f"\ntext 内容: {text[:200]}...")
    else:
        print("响应中没有 candidates")

    # 检查 text 属性
    if hasattr(response, 'text'):
        print(f"\n响应 text: {response.text[:200] if response.text else 'None'}...")

except Exception as e:
    print(f"\n错误: {e}")
    import traceback
    print(f"详细错误:\n{traceback.format_exc()}")
