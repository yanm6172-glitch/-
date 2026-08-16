# 竹韵江南
**一款基于 Unity 开发的 2D 古风触屏音游，致力于传承江南丝竹这一国家级非物质文化遗产**<!-- 这是一张图片，ocr 内容为： -->
![](https://img.shields.io/badge/Unity-2D-blue.svg)<!-- 这是一张图片，ocr 内容为： -->
![](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20PC-lightgrey.svg)

---

## 📖 项目简介
《竹韵江南》是一款将国家级非物质文化遗产"江南丝竹"与现代游戏交互相结合的 2D 音游。游戏通过触屏操作还原古筝、琵琶、二胡、箫等传统乐器的演奏体验，实现非遗文化的数字化保护与游戏化传播。

### 核心理念
+ 🎵 **文化传承**：以游戏形式推广江南丝竹文化
+ 🎮 **创新交互**：多样化的触屏手势模拟真实乐器演奏
+ 📱 **跨平台支持**：iOS、Android、PC 全平台覆盖
+ 🎯 **游戏化学习**：寓教于乐，让传统音乐触手可及

<!-- 这是一张图片，ocr 内容为：炫乐-览透 竖乐-古作 管乐-饼 公乐-,胡 开始游戏 -->
![](https://cdn.nlark.com/yuque/0/2026/png/51585215/1768730242605-2dad1594-f788-4c6d-9abc-4f081803c7c4.png)

---

## ✨ 核心特性
### 🎼 四大乐器系统
游戏包含四种核心传统乐器，每种乐器拥有独特的轨道配置和音符下落方式：

| 乐器 | 轨道数 | 下落方向 | 判定线方向 |
| :---: | :---: | :---: | :---: |
| **古筝** | 13 轨道 | 左→右 | 竖直 |
| **琵琶** | 4 轨道 | 左→右 | 竖直 |
| **二胡** | 6 轨道 | 上→下 | 水平 |
| **箫** | 5 轨道 | 上→下 | 水平 |


<!-- 这是一张图片，ocr 内容为：竖乐-昆透 新乐-饼 艺乐-吉华 临东-后制 -->
![](https://cdn.nlark.com/yuque/0/2026/png/51585215/1768730345139-8de14799-1699-490d-ad52-cfef1a8c9968.png)

### 🎯 五种操作手势
+ **Single Tap (Tap)**：单次点击
+ **Drag**：拖动滑动，需从起始轨道滑动到结束轨道
+ **Double Tap (Double)**：快速双击
+ **Flick**：快速滑动，向任意方向滑动
+ **Hold**：按住并保持，需持续按住直至结束

### ⚖️ 判定系统
+ **Perfect**：±0.05 秒内
+ **Great**：±0.1 秒内
+ **Normal**：±0.2 秒内
+ **Miss**：超过 ±0.2 秒或未击中（重置连击）

### 📊 计分系统
+ **总分**：满分 1000 分 = 判定分 (900) + 连击分 (100)
+ **判定分权重**：Perfect (100%)、Great (85%)、Normal (60%)、Miss (0%)
+ **连击分计算**：(最大连击数 / 谱面 Note 总数) × 1000

<!-- 这是一张图片，ocr 内容为：000000 暂停 75% 中等三 不错! X3 -->
![](https://cdn.nlark.com/yuque/0/2026/png/51585215/1768730377064-a5227123-e30d-4844-825a-47c5e078e512.png)

---

## 🏗️ 技术架构
### 核心脚本架构
```plain
Assets/Scripts/
├── GestureControl/          # 手势控制系统
│   ├── NoteControl.cs       # 音符基类
│   ├── TapControl.cs        # Tap/Double 音符控制
│   ├── DragControl.cs       # Drag 音符控制
│   ├── FlickControl.cs      # Flick 音符控制
│   ├── HoldControl.cs       # Hold 音符控制
│   └── TouchInput.cs        # 触摸输入处理
├── gameController.cs        # 游戏主控制器
├── DataTransfer.cs          # 全局数据枢纽
├── MusicPlayer.cs           # 音频播放管理
├── ChooseInstrument.cs      # 乐器选择
├── SceneLoader.cs           # 场景加载
└── AudioMixerController.cs  # 音频混合器控制
```

### 数据流程
```plain
输入处理 (TouchInput)
    ↓
命中判定 (NoteControl.CheckHit)
    ↓
结果入队 (DataTransfer.judgmentQueue)
    ↓
结果处理 (GameController)
    ↓
计分与特效
    ↓
对象池回收 (NoteControl.ReturnToPool)
```

### 关键技术点
+ **对象池模式**：音符对象复用，避免频繁 GC
+ **队列通信**：`DataTransfer.judgmentQueue` 实现解耦的判定结果传递
+ **多态设计**：音符类型通过继承 `NoteControl` 实现差异化逻辑
+ **时间管理**：统一的 `deltaTime` 管理，支持暂停功能

---

## 📁 项目结构
```plain
竹韵江南/
├── Assets/
│   ├── Scripts/              # C# 脚本文件
│   │   ├── GestureControl/   # 手势控制相关
│   │   └── ...
│   ├── Scenes/               # Unity 场景文件
│   │   ├── Home.unity        # 主菜单
│   │   ├── ChooseInstrument.unity  # 乐器选择
│   │   ├── ChooseMusic.unity # 曲目选择
│   │   ├── GuZheng.unity     # 古筝游戏场景
│   │   ├── PiPa.unity        # 琵琶游戏场景
│   │   ├── ErHu.unity        # 二胡游戏场景
│   │   └── Xiao.unity        # 箫游戏场景
│   ├── Resources/            # 资源文件
│   │   ├── BeatMap/          # 谱面 CSV 文件
│   │   └── ...
│   ├── Prefab/               # 预制体
│   └── FigmaImporter/        # Figma 导入资源
├── ProjectSettings/          # Unity 项目设置
├── Packages/                 # 项目依赖
└── Project_Summary.md        # 项目摘要文档
```

---

## 📝 谱面文件格式
谱面采用 **CSV** 格式存储，字段说明如下：

### 文件格式
```plain
Type,BeginTime,EndTime,BeginIndex,EndIndex
```

### 字段说明
| 字段 | 类型 | 说明 | 示例 |
| :---: | :---: | :--- | :--- |
| **Type** | String | 音符类型：`tap`, `drag`, `double`, `flick`, `hold` | `tap` |
| **BeginTime** | Float | 开始时间（秒，精确到两位小数） | `0.50` |
| **EndTime** | Float | 结束时间（仅 Hold 有效，其他留空） | `4.00` |
| **BeginIndex** | Int | 起始轨道编号（从 1 开始） | `2` |
| **EndIndex** | Int | 结束轨道编号（仅 Drag 有效，其他留空） | `3` |


### 示例数据
```plain
Type,BeginTime,EndTime,BeginIndex,EndIndex
tap,0.50,,1,
drag,1.00,,2,3
hold,2.50,4.00,2,
flick,3.20,,4,
```

### 谱面位置
谱面文件应放置在 `Assets/Resources/BeatMap/` 目录下，文件格式为 `{曲目名}.csv`。

---

## 🚀 快速开始
### 环境要求
+ **Unity 版本**：建议 Unity 2021.3 LTS 或更高版本
+ **开发平台**：Windows / macOS / Linux
+ **目标平台**：iOS / Android / PC (Windows/macOS)

### 运行步骤
1. **克隆项目**

```bash
git clone https://github.com/Erd-omg/ZhuYunJiangNan
cd 竹韵江南
```

2. **打开项目**
    - 使用 Unity Hub 打开项目文件夹
    - 等待 Unity 自动导入依赖包
3. **运行游戏**
    - 在 Unity Editor 中打开 `Assets/Scenes/Home.unity`
    - 点击 Play 按钮开始游戏

### 依赖插件
项目使用了以下 Unity 插件/包：

+ **DOTween**：动画补间库
+ **TextMesh Pro**：高质量文本渲染
+ **Figma Importer**：Figma 资源导入工具

### 字体文件
项目使用了 **Aa古典刻本宋** 字体来呈现古风界面效果。由于字体文件较大（超过 100MB），未包含在 Git 仓库中。

**下载字体文件**：
1. 访问字体下载页面：[Aa古典刻本宋字体下载](https://www.fonts.net.cn/font-42754180125.html)
2. 下载字体文件：`AaGuDianKeBenSong-2.ttf`（约 6.8MB）
3. 将字体文件导入到 Unity 项目中：`Assets/Font/` 目录下
4. 在 Unity Editor 中将字体转换为 TextMesh Pro 使用的 SDF 格式

**注意**：
- 该字体为 Aa字库 出品，属于非商免字体
- 如需用于商业用途，请与权属方联系并取得书面授权
- 字体文件版权归原作者所有

---

## 🎮 核心脚本说明
### NoteControl.cs
音符基类，负责音符的移动、回收和基础判定逻辑。

**关键方法**：

+ `InitializeNote()`：初始化音符参数
+ `CheckAutoMiss()`：检查自动 Miss 逻辑
+ `ReturnToPool()`：回收到对象池

### TouchInput.cs
核心输入控制器，统一处理触摸和鼠标输入。

**关键方法**：

+ `ProcessMobileTouches()`：处理移动端触摸输入
+ `CheckNoteInteraction()`：检测音符交互

### gameController.cs
游戏主控制器，负责音符生成、计分计算和 UI 更新。

**关键方法**：

+ `SpawnNotes()`：根据谱面生成音符
+ `CalculateScore()`：计算得分
+ `UpdateUI()`：更新游戏 UI

### DataTransfer.cs
全局数据枢纽，存储游戏状态和共享参数。

**关键成员**：

+ `GameParams`：游戏参数配置
+ `judgmentQueue`：判定结果队列
+ `activeNotes`：当前活跃音符集合

---

## 📈 项目现状
### ✅ 已完成功能
+ ✅ UI 界面设计（主菜单、乐器选择、结算页面）
+ ✅ 交互原型开发（支持点击、滑动、长按等操作）
+ ✅ 基础乐器逻辑（四种乐器的轨道差异实现）
+ ✅ 20+ 首曲目编谱（包含《青花瓷》《红尘客栈》等）
+ ✅ 判定系统与计分系统
+ ✅ 对象池优化

### 🔄 待优化/开发项
+ **技术优化**
    - 解决箫等吹管乐器的高频泛音采样还原问题
    - 优化多乐器协同时的动态节奏判定算法
    - 性能优化与内存管理
+ **功能扩展**
    - 添加点击音效反馈
    - 将触控判定区域从"点"改为"小圆块"以降低误触
    - 添加难度选择系统
+ **内容补充**
    - 增加"名曲故事"剧情模式
    - 完善成就系统和排行榜
    - 添加教程引导系统

---

## 📄 许可证
本项目为教育/文化传承项目，请遵循相应的使用许可。

---

## 👥 贡献
欢迎提交 Issue 和 Pull Request 来帮助改进项目！

---

## 📞 联系方式
如有任何问题或建议，请通过以下方式联系：

+ 提交 [Issue](../../issues)

---

**让传统文化在指尖绽放** ✨ Made with ❤️ for Cultural Heritage Preservation 

