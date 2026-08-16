一、代码作用
1、音符控制脚本
	1）TapControl.cs    -处理单击和双击逻辑。
	2）DragControl.cs
	3）FlickControl.cs
	4）HoldControl.cs
2、数据传递脚本
	DataTransfer.cs    
	-
3、游戏控制器脚本
	gameController.cs    
	-游戏核心控制器，负责解析CSV谱面、生成音符、管理游戏流程。
4、音符生成与下落控制
	NoteControl.cs    
	-控制音符移动逻辑，支持水平和竖直方向下落。
5、玩家输入脚本
	TouchInput.cs    -处理玩家输入，适配不同方向。

二、使用方法
1、绑定预制体：
	将tap、drag、flick、hold预制体拖拽到gameController组件的notePrefabMap字典中。
2、设置乐器类型：
	在gameController组件中选择当前乐器（Guzheng/Pipa/Erhu/Xiao）。
3、绑定CSV文件：
    将CSV文件拖拽到gameController的chart字段。