using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public static class DataTransfer 
{
    //public static float holdTime;
    //public static float deltaTime;
    //public static gameController controller;
    //public static List<TapControl> tapJudgeList = new List<TapControl>();
    //public static List<DragControl> dragJudgeList = new List<DragControl>();
    //public static List<FlickControl> flickJudgeList = new List<FlickControl>();
    //public static List<HoldControl> headJudgeList = new List<HoldControl>();
    //public static List<HoldControl> holdingJudgeList = new List<HoldControl>();

    //====================================
    // 游戏状态参数
    //====================================
    public static bool isPaused;          // 暂停状态
    public static bool isMusicPaused;
    public static float deltaTime;        // 帧时间（已处理暂停状态）
    public static float unscaledDeltaTime;// 原始帧时间
    public static gameController controller;

    //====================================
    // 音符池配置
    //====================================

    // 统一音符管理系统
    public static readonly HashSet<NoteControl> activeNotes = new HashSet<NoteControl>(); // 存储当前活动的音符

    // 对象池配置参数
    public static class PoolConfig
    {
        public const int InitialTapPoolSize = 20;
        public const int InitialDoublePoolSize = 10;
        public const int InitialDragPoolSize = 15;
        public const int InitialFlickPoolSize = 10;
        public const int InitialHoldPoolSize = 10;
    }

    //====================================
    // 判定阈值
    //====================================

    // 判定类型
    public enum JudgmentType
    {
        Perfect,
        Great,
        Normal,
        Miss
    }

    // 判定数据结构
    public struct JudgmentData
    {
        public NoteControl note;
        public JudgmentType judgmentType;
        public float timeDiff;
        public Vector3 position;
    }

    // 判定队列
    public static readonly Queue<JudgmentData> judgmentQueue = new Queue<JudgmentData>(); // 存储待处理的判定数据

    // 游戏参数配置
    public static class GameParams
    {
        // 判定区间阈值
        public const float sigleJudgmentRange = 60f;
        public const float doubleJudgmentRange = 170f;

        // 判定时间阈值
        public const float PerfectThreshold = 1.4f;
        public const float GreatThreshold = 1.6f;
        public const float NormalThreshold = 2.0f; 

        // 音符时间阈值
        public const float DoubleTapInterval = 0.7f;
        public const float DragThreshold = 1.0f;
        public const float FlickThreshold = 0.1f;
        public const float HoldThreshold = 1.0f;
        public const float HoldDuration = 2.0f;

        // 判定分数
        public const int PerfectScore = 100;
        public const int GreatScore = 85;
        public const int NormalScore = 60;
        public const int MissScore = 0;
    }

    //====================================
    // 重置游戏状态
    //====================================
    public static void ResetGameState()
    {
        activeNotes.Clear();// 清空活动音符集合
        judgmentQueue.Clear();// 清空判定队列
        isPaused = false;
        isMusicPaused = false;
        deltaTime = 0;
        unscaledDeltaTime = 0;
    }


}
