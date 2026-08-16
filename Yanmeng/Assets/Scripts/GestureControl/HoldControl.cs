using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using static DataTransfer;

// 长按音符控制逻辑
public class HoldControl : NoteControl
{
    public GameObject holdCompleteEffectPrefab;
    public RectTransform holdBody;
    private float holdDuration;// 需要按住的时间
    private float holdingTime; // 已经按住的时间
    private bool isHolding = false; // 标记是否正在按住
    private float holdStartTime;
    public GameObject noteHead; // 音符头控件

    private void OnEnable()
    {
        base.OnEnable();
        holdDuration = DataTransfer.GameParams.HoldDuration;
        InitVisualPosition();
    }

    public override void InitializeNote(float speed, bool isVertical, int beginIndex, int endIndex, float beginTime, float endTime)
    {
        base.InitializeNote(speed, isVertical, beginIndex, endIndex, beginTime, endTime);

        // 计算保持时长
        holdDuration = EndTime - BeginTime;

        // 设置初始长度
        UpdateHoldVisual(holdDuration);

        // 初始化头控件位置
        Vector2 headPos = DataTransfer.controller.CalculateSpawnPosition(beginIndex);
        noteHead.transform.position = headPos;
    }

    // 更新Hold视觉效果
    void UpdateHoldVisual(float remainingTime)
    {
        if (holdBody == null) return;

        float height = remainingTime * Speed * 2f; // 根据速度调整视觉长度

        if (IsVertical)
        {
            holdBody.sizeDelta = new Vector2(holdBody.sizeDelta.x, height);
        }
        else
        {
            holdBody.sizeDelta = new Vector2(height, holdBody.sizeDelta.y);
        }
    }

    // 初始化长按音符的ui
    private void InitVisualPosition()
    {
        if (DataTransfer.controller.IsVerticalInstrument())
        {
            transform.position = new Vector3(0, GetVerticalPosition(BeginIndex), 0);
        }
        else
        {
            transform.position = new Vector3(GetHorizontalPosition(BeginIndex), 0, 0);
        }
    }

    // 头部点击判定
    public override bool CheckHit(Vector2 inputPos, TouchPhase phase)
    {
        // 头部点击判定（开始按住）
        if (phase == TouchPhase.Began)
        {
            if (base.CheckHit(inputPos, phase))
            {
                isHolding = true;
                holdStartTime = Time.time;
                return false; // 不结束触摸，继续跟踪
            }
        }
        // 结束按住判定
        else if (phase == TouchPhase.Ended && isHolding)
        {
            // 检查按住时间是否足够
            if (Time.time - holdStartTime >= (EndTime - BeginTime))
            {
                HandleHit();
                isHolding = false;
                return true;
            }
            else
            {
                // 按住时间不足，判定为Miss
                HandleMiss();
                isHolding = false;
                return false;
            }
        }

        return false;
        //float x = DataTransfer.controller.IsVerticalInstrument() ?
        //    Mathf.Abs(transform.position.y - inputPos.y) :
        //    Mathf.Abs(transform.position.x - inputPos.x);
        //if (x < DataTransfer.GameParams.PerfectThreshold)
        //{
        //    StartCoroutine(HoldingTimer());
        //    return true;
        //}
        //return false;
    }

    // 持续按住检测协程
    private IEnumerator HoldingTimer()
    {
        isHolding = true;
        float remainingTime = holdDuration;

        while (remainingTime > 0)
        {
            if (DataTransfer.isPaused)
            {
                yield return null;
                continue;
            }

            // 更新视觉长度
            remainingTime -= Time.deltaTime;
            UpdateHoldVisual(remainingTime);

            // 检查是否仍然按住
            if (!IsHoldingAtPosition())
            {
                HandleMiss();
                yield break;
            }

            yield return null;
        }

        HandleHit();// 成功完成Hold
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
        ReturnToPool();
    }

    // 检查是否仍然按住
    private bool IsHoldingAtPosition()
    {
        Vector2 inputPos = GetInputPosition();
        float distance = DataTransfer.controller.IsVerticalInstrument() ?
            Mathf.Abs(transform.position.y - inputPos.y) :
            Mathf.Abs(transform.position.x - inputPos.x);

        return distance < DataTransfer.GameParams.HoldThreshold;
    }

    // 适配不同乐器方向
    private Vector2 GetInputPosition()
    {
        #if UNITY_EDITOR
                return Camera.main.ScreenToWorldPoint(Input.mousePosition);
        #else
            return Input.touches[0].position;
        #endif
    }

    public override void HandleMiss()
    {
        if (isMissed) return;
        isMissed = true;

        //float timeDiff = CalculateTimingAccuracy();
        //EnqueueJudgmentWithType(JudgmentType.Miss, timeDiff);

        DataTransfer.JudgmentData data = new DataTransfer.JudgmentData
        {
            note = this,
            judgmentType = JudgmentType.Miss,
            timeDiff = CalculateTimingAccuracy(),
            position = transform.position
        };
        DataTransfer.judgmentQueue.Enqueue(data);

        image.sprite = miss;
        DataTransfer.activeNotes.Remove(this);

        Debug.Log($"HOLD音符未完成，判定MISS");

        base.HandleMiss();
    }



    private void Update()
    {
        UpdateMovement();
    }

    public override void HandleHit()
    {
        //// 持续按住完成后的逻辑
        //float totalTimeDiff = Mathf.Abs(Time.time - _expectedHitTime);
        //JudgmentType judgment = GetJudgmentType(totalTimeDiff);

        // HOLD音符强制为PERFECT判定
        JudgmentType forcedJudgment = JudgmentType.Perfect;

        DataTransfer.JudgmentData data = new DataTransfer.JudgmentData
        {
            note = this,
            judgmentType = forcedJudgment,
            timeDiff = 0, // 强制PERFECT，时间差设为0
            position = transform.position
        };

        // 生成持续按住特效
        ShowHoldCompletionEffect();

        // 提交判定数据
        //DataTransfer.JudgmentData data = new DataTransfer.JudgmentData
        //{
        //    note = this,
        //    judgmentType = judgment,
        //    timeDiff = totalTimeDiff,
        //    position = transform.position
        //};
        DataTransfer.judgmentQueue.Enqueue(data);

        base.HandleHit();
    }

    private void ShowHoldCompletionEffect()
    {
        Instantiate(holdCompleteEffectPrefab, transform.position, Quaternion.identity);
    }

    //public bool HeadJudge(float xPosition)
    //{
    //    float x=System.Math.Abs(transform.position.x - xPosition);
    //    if (x < 1)// 点击范围
    //    {
    //        remove =false;
    //        // 将判定事件加入队列
    //        DataTransfer.judgmentQueue.Enqueue(this);
    //        holding = true;
    //        //按住判定
    //        StartCoroutine("HoldingTimer");
    //        return true;
    //    }
    //    return false;
    //}

    //public bool HoldingJudge(float xPosition)
    //{
    //    float x = System.Math.Abs(transform.position.x - xPosition);
    //    if(x < 1)
    //    {
    //        holding = true;
    //        return true;
    //    }
    //    return false ;
    //}

    //IEnumerator HoldingTimer()
    //{
    //    while(holding)
    //    {
    //        if (DataTransfer.isPaused)
    //        {
    //            yield return null; // 暂停时跳过
    //            continue;
    //        }

    //        holdingTime += DataTransfer.deltaTime;
    //        holding = false;
    //        //调整音符的长度和位置
    //        transform.position = new Vector3(1, 1, (holdDuration - holdingTime) * 7.5f);
    //        transform.Translate(0, 0, 7.5f * DataTransfer.deltaTime);//原速度的一半（头部不动，长度缩短）

    //        if(holdingTime >holdDuration)
    //        {
    //            //DataTransfer.controller.GenerateEffect(myTime, transform.position.x);
    //            //DataTransfer.holdingJudgeList.Remove(this);
    //            //DataTransfer.controller.JudgeNote(hitTime);

    //            HandleHit(); // 触发命中逻辑
    //            Destroy(gameObject);
    //            break;
    //        }
    //        yield return 0;//程序运行到此处立即退出（每一帧执行一次的死循环）
    //    }
    //    if(holdingTime<holdDuration)
    //    {
    //        HandleMiss();
    //    }

    //}

}
