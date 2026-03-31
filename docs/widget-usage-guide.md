# Widget 使用指南

## 如何让 AI 返回互动图表

### 1. 基本格式

在 system prompt 中添加以下指令：

```
你可以使用 show-widget 代码围栏创建交互式可视化图表。

格式：
```show-widget
{"title":"图表标题","widget_code":"<HTML代码>"}
```

规则：
1. widget_code 是 JSON 字符串，需要转义引号和换行符
2. 不要包含 DOCTYPE/html/head/body 标签
3. 背景透明，由宿主提供
4. 每个 widget ≤ 3000 字符
5. CDN 白名单：cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh
```

### 2. 示例：简单图表

**用户提问：**
```
帮我创建一个显示月度销售数据的柱状图
```

**AI 应该返回：**
````markdown
这是你的销售数据图表：

```show-widget
{"title":"monthly_sales","widget_code":"<div style=\"width:100%;min-height:300px\"><canvas id=\"c\"></canvas></div><script src=\"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js\" onload=\"init()\"></script><script>function init(){new Chart(document.getElementById('c'),{type:'bar',data:{labels:['1月','2月','3月','4月','5月','6月'],datasets:[{label:'销售额',data:[12000,19000,15000,25000,22000,30000],backgroundColor:'rgba(99,102,241,0.8)'}]},options:{responsive:true,maintainAspectRatio:false}});}</script>"}
```
````

### 3. 示例：SVG 流程图

**用户提问：**
```
画一个用户注册流程图
```

**AI 应该返回：**
````markdown
用户注册流程如下：

```show-widget
{"title":"user_registration","widget_code":"<svg width=\"100%\" viewBox=\"0 0 680 300\"><defs><marker id=\"a\" viewBox=\"0 0 10 10\" refX=\"8\" refY=\"5\" markerWidth=\"6\" markerHeight=\"6\" orient=\"auto-start-reverse\"><path d=\"M2 1L8 5L2 9\" fill=\"none\" stroke=\"#94A3B8\" stroke-width=\"1.5\"/></marker></defs><rect x=\"40\" y=\"40\" width=\"120\" height=\"60\" rx=\"8\" fill=\"#EEF2FF\" stroke=\"#C7D2FE\"/><text x=\"100\" y=\"75\" text-anchor=\"middle\" fill=\"#3730A3\" font-size=\"14\">填写信息</text><path d=\"M160 70 L220 70\" stroke=\"#94A3B8\" stroke-width=\"1.5\" marker-end=\"url(#a)\"/><rect x=\"220\" y=\"40\" width=\"120\" height=\"60\" rx=\"8\" fill=\"#ECFDF5\" stroke=\"#A7F3D0\"/><text x=\"280\" y=\"75\" text-anchor=\"middle\" fill=\"#065F46\" font-size=\"14\">验证邮箱</text><path d=\"M340 70 L400 70\" stroke=\"#94A3B8\" stroke-width=\"1.5\" marker-end=\"url(#a)\"/><rect x=\"400\" y=\"40\" width=\"120\" height=\"60\" rx=\"8\" fill=\"#FFFBEB\" stroke=\"#FDE68A\"/><text x=\"460\" y=\"75\" text-anchor=\"middle\" fill=\"#92400E\" font-size=\"14\">注册完成</text></svg>"}
```
````

### 4. 示例：交互式控件

**用户提问：**
```
创建一个贷款计算器
```

**AI 应该返回：**
````markdown
这是一个简单的贷款计算器：

```show-widget
{"title":"loan_calculator","widget_code":"<div style=\"padding:16px;min-height:200px\"><div style=\"margin-bottom:12px\"><label>贷款金额：<span id=\"amt\">100000</span> 元</label><input type=\"range\" id=\"amount\" min=\"10000\" max=\"1000000\" value=\"100000\" step=\"10000\" style=\"width:100%\" oninput=\"calc()\"></div><div style=\"margin-bottom:12px\"><label>年利率：<span id=\"rt\">4.5</span>%</label><input type=\"range\" id=\"rate\" min=\"1\" max=\"10\" value=\"4.5\" step=\"0.1\" style=\"width:100%\" oninput=\"calc()\"></div><div style=\"margin-bottom:12px\"><label>贷款年限：<span id=\"yr\">10</span> 年</label><input type=\"range\" id=\"years\" min=\"1\" max=\"30\" value=\"10\" style=\"width:100%\" oninput=\"calc()\"></div><div style=\"padding:12px;background:rgba(99,102,241,0.1);border-radius:8px;font-size:18px;font-weight:500\">月供：<span id=\"result\">0</span> 元</div></div><script>function calc(){var a=+document.getElementById('amount').value;var r=+document.getElementById('rate').value/100/12;var n=+document.getElementById('years').value*12;var m=a*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);document.getElementById('amt').textContent=a.toLocaleString();document.getElementById('rt').textContent=document.getElementById('rate').value;document.getElementById('yr').textContent=document.getElementById('years').value;document.getElementById('result').textContent=Math.round(m).toLocaleString();}calc();</script>"}
```
````

### 5. 关键注意事项

#### ✅ 正确做法：
- widget_code 是一个 JSON 字符串，需要转义
- 使用 CDN 白名单中的库
- 背景透明
- 文字说明放在围栏外面

#### ❌ 错误做法：
```markdown
❌ 不要这样（未转义的 JSON）：
```show-widget
{"title":"test","widget_code":<div style="color:red">Test</div>}
```

❌ 不要这样（包含完整 HTML 结构）：
```show-widget
{"title":"test","widget_code":"<!DOCTYPE html><html><head>...</head><body>...</body></html>"}
```

❌ 不要这样（使用未授权的 CDN）：
```show-widget
{"title":"test","widget_code":"<script src=\"https://unknown-cdn.com/lib.js\"></script>"}
```
```

### 6. System Prompt 模板

将以下内容添加到你的 system prompt：

```
<widget-capability>
你可以使用 `show-widget` 代码围栏创建交互式可视化。

格式：
```show-widget
{"title":"snake_case_id","widget_code":"<HTML/SVG字符串>"}
```

规则：
1. widget_code 是 JSON 字符串 — 转义引号、换行符
2. 不要包含 DOCTYPE/html/head/body
3. 背景透明
4. 每个 widget ≤ 3000 字符
5. CDN 白名单：cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh
6. 文字说明放在围栏外面
7. SVG 使用：<svg width="100%" viewBox="0 0 680 H">
8. Chart.js 模式：<canvas id="c"></canvas> + CDN script + init()
</widget-capability>
```

### 7. 测试提示词

你可以用这些提示词测试功能：

1. "创建一个显示过去6个月销售趋势的折线图"
2. "画一个软件开发流程的流程图"
3. "做一个BMI计算器"
4. "展示公司组织架构图"
5. "创建一个产品对比表格"

---

## 技术细节

- 所有 widget 在 sandbox iframe 中运行（`sandbox="allow-scripts"`）
- CSP 限制：`connect-src 'none'`（禁止网络请求）
- 自动高度调整
- 支持深色/浅色主题切换
