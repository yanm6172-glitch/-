using UnityEngine;
using static DataTransfer;

// 单击/双击音符控制逻辑
public class TapControl : NoteControl
{
    //public GameObject tapHitEffectPrefab;
    float lastTapTime = -1;

    void Update()
    {
        if (DataTransfer.isPaused) return;

        if (!DataTransfer.activeNotes.Contains(this))
            DataTransfer.activeNotes.Add(this);
        base.Update();
    }

    // 处理点击事件
    //public override bool CheckHit(Vector2 inputPos)
    //{
    //    float x = Mathf.Abs(transform.position.x - inputPos.x);
    //    if (x > DataTransfer.GameParams.PerfectThreshold) return false;

    //    // 计算时间差
    //    float timeDiff = CalculateTimingAccuracy();
    //    JudgmentType judgmentType = GetJudgmentType(timeDiff);

    //    // 双击判定
    //    if (Type == "double")
    //    {
    //        if (Time.time - lastTapTime <= DataTransfer.GameParams.DoubleTapInterval)
    //        {
    //            Debug.Log("Double Tap!");
    //            judgmentType = JudgmentType.Perfect; // 双击强制Perfect
    //            lastTapTime = -1; // 重置,避免连续三次点击误判
    //        }
    //    }
    //    // 单击记录时间戳
    //    else
    //    {
    //        lastTapTime = Time.time;
    //    }

    //    // 入队判定
    //    EnqueueJudgmentWithType(judgmentType, timeDiff);
    //    return true;
    //}
    // 处理双击逻辑
    public override bool CheckHit(Vector2 inputPos, TouchPhase phase)
    {
        //float distance = DataTransfer.controller.IsVerticalInstrument() ?
        //    Mathf.Abs(transform.position.y - inputPos.y) :
        //    Mathf.Abs(transform.position.x - inputPos.x);

        //if (distance > DataTransfer.GameParams.PerfectThreshold)
        //    return false;

        // 只处理点击开始事件
        if (phase != TouchPhase.Began) return false;

        // 调用基础距离判定
        if (!base.CheckHit(inputPos, phase)) return false;

        // 双击音符特殊处理
        if (Type == "double")
        {
            if (lastTapTime < 0)
            {
                lastTapTime = Time.time;// 第一次点击
                return false; // 等待第二次点击
            }
            else
            {
                // 检查第二次点击时间间隔
                if (Time.time - lastTapTime <= DataTransfer.GameParams.DoubleTapInterval)
                {
                    HandleHit();
                    lastTapTime = -1; // 重置点击时间
                    return true;
                }
                else
                {
                    // 超时重置
                    lastTapTime = -1;
                    return false;
                }
            }
        }

        // 普通点击
        HandleHit();
        return true;
    }

    private void EnqueueJudgmentWithType(JudgmentType type, float timeDiff)
    {
        DataTransfer.JudgmentData data = new DataTransfer.JudgmentData
        {
            note = this,
            judgmentType = type,
            timeDiff = timeDiff,
            position = transform.position
        };
        DataTransfer.judgmentQueue.Enqueue(data);
        //ReturnToPool();
    }

    public override void HandleHit()
    {
        // 双击特殊处理
        if (Type == "double" && Time.time - lastTapTime <= DataTransfer.GameParams.DoubleTapInterval)
        {
            JudgmentType forcedJudgment = JudgmentType.Perfect;
            EnqueueJudgmentWithType(forcedJudgment, 0);
            Debug.Log("完美双击判定！");
        }

        // 常规点击处理
        float timeDiff = CalculateTimingAccuracy();
        JudgmentType judgment = GetJudgmentType(timeDiff);
        EnqueueJudgmentWithType(judgment, timeDiff);

        // 播放点击光效
        //Instantiate(tapHitEffectPrefab, transform.position, Quaternion.identity);

        base.HandleHit();
    }
    public override void HandleMiss()
    {
        //EnqueueJudgmentWithType(JudgmentType.Miss, CalculateTimingAccuracy());
        DataTransfer.activeNotes.Remove(this);
        base.HandleMiss(); // 基类回收
    }

    //    public bool JudgeNote(float Position)
    //    {
    //        float x=System.Math.Abs(transform.position.x-Position);
    //        if(x<1)// 点击范围
    //        {
    //            if (Time.time - lastTapTime < doubleTapThreshold)
    //            {
    //                Debug.Log("Double Tap!");// 双击
    //                lastTapTime = -1;
    //                return true;
    //            }
    //            else
    //            {
    //                lastTapTime = Time.time;
    //            }
    //            //DataTransfer.controller.GenerateEffect(myTime, transform.position.x);
    //            DataTransfer.activeNotes.Remove(GetComponent<NoteControl>());
    //            //DataTransfer.controller.JudgeNote(myTime);
    //            Destroy(gameObject);
    //            return true;
    //        }
    //        return false;
    //    }
   
}
