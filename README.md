# 划词即翻译

选中文字后自动中英互译，翻译结果显示在选区旁边。没有登录、设置页、历史记录或账号体系。

第一版不申请 Azure / Google Cloud。翻译顺序是：

1. Google Translate 公开接口（无需 Key）
2. Google Dictionary 备用接口
3. MyMemory（匿名额度很小，只作最后兜底）

等“划词即翻译”确认好用，再换成有正式额度的 Azure / Google Cloud。

## 加载插件

1. Chrome 打开 `chrome://extensions`
2. 打开右上角 **开发者模式**
3. **加载已解压的扩展程序**，选中本目录
4. 如果已经加载过，点一次刷新，并刷新 ChatGPT / Google / GitHub 页面
5. 选中一段中文或英文

成功标准：选中后大约 0.5～1 秒，选区旁边直接出现翻译，不需要再点任何按钮。

如果页面提示扩展申请访问 `translate.googleapis.com`，需要允许；否则翻译请求会被拦住。
