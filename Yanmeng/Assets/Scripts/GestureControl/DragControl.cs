using UnityEngine;
using UnityEngine.UI;
using static DataTransfer;

// 拖动音符控制逻辑
public class DragControl : NoteControl
{
    public LineRenderer dragLine; // 用于绘制滑动路径
    private bool isDragging = false; // 标记是否正在滑动
    private Vector2 startPos; // 滑动起始位置
    private Vector2 endPos; // 滑动结束位置

    public GameObject noteHead; // 音符头控件
    public GameObject noteTail; // 音符尾控件

    void Start()
    {
        UpdateDragVisual();
    }

    // 更新拖拽视觉效果
    void UpdateDragVisual()
    {
        if (dragLine == null) return;

        startPos = noteHead.transform.position;
        endPos = noteTail.transform.position;

        dragLine.positionCount = 2;
        dragLine.SetPosition(0, startPos);
        dragLine.SetPosition(1, endPos);

        // 设置 LineRenderer 的宽度
        float distance = Vector2.Distance(startPos, endPos);
        dragLine.startWidth = distance * 0.05f; // 根据距离动态调整宽度
        dragLine.endWidth = distance * 0.05f;

        // 调整 LineRenderer 的方向
        if (DataTransfer.controller.IsVerticalInstrument())
        {
            dragLine.transform.rotation = Quaternion.identity; // 竖直方向
        }
        else
        {
            // 水平方向，根据起始点和终点调整旋转
            Vector3 direction = endPos - startPos;
            float angle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg;
            dragLine.transform.rotation = Quaternion.AngleAxis(angle, Vector3.forward);
        }
    }

    public override void InitializeNote(float speed, bool isVertical, int beginIndex, int endIndex, float beginTime, float endTime)
    {
        base.InitializeNote(speed, isVertical, beginIndex, endIndex, beginTime, endTime);
        // 初始化音符头尾位置
        Vector2 headPos = DataTransfer.controller.CalculateSpawnPosition(beginIndex);
        Vector2 tailPos = DataTransfer.controller.CalculateSpawnPosition(endIndex);

        // 设置音符头尾位置
        noteHead.transform.position = headPos;
        noteTail.transform.position = tailPos;

        // 更新拖拽视觉效果
        UpdateDragVisual();
    }

    void Update()
    {
        if (DataTransfer.isPaused || !isActive) return;

        UpdateMovement();

        //// 检测是否进入/离开判定区间
        //float currentTime = Time.time;
        //float timeDiff = currentTime - _expectedHitTime;
        //float judgmentRange = DataTransfer.GameParams.NormalThreshold;

        //if (!inJudgmentRange && Mathf.Abs(timeDiff) <= judgmentRange)
        //{
        //    EnterJudgmentRange();
        //}
        //else if (inJudgmentRange && Mathf.Abs(timeDiff) > judgmentRange)
        //{
        //    ExitJudgmentRange();
        
        base.Update();

        CheckAutoMiss();

        if (isMissed && IsOutOfScreen())
        {
            ReturnToPool();
        }
    }

    // 检测拖动输入是否命中
    public override bool CheckHit(Vector2 inputPos, TouchPhase phase)
    {
        // 只处理移动事件
        if (phase != TouchPhase.Moved) return false;

        // 检查滑动方向是否正确
        Vector2 direction = (inputPos - startPos).normalized;
        bool isDirectionValid = DataTransfer.controller.IsVerticalInstrument() ?
            Mathf.Sign(EndIndex - BeginIndex) == Mathf.Sign(direction.y) :
            Mathf.Sign(EndIndex - BeginIndex) == Mathf.Sign(direction.x);

        if (!isDirectionValid) return false;

        // 检查滑动位置是否到达终点
        float distance = Vector2.Distance(inputPos, endPos);
        if (distance > DataTransfer.GameParams.DragThreshold) return false;

        HandleHit();
        return true;
    }

    public override void HandleHit()
    {
        // 计算时间差并入队判定
        float timeDiff = CalculateTimingAccuracy();
        EnqueueJudgment();

        // DRAG音符强制为PERFECT判定
        JudgmentType forcedJudgment = JudgmentType.Perfect;

        DataTransfer.JudgmentData data = new DataTransfer.JudgmentData
        {
            note = this,
            judgmentType = forcedJudgment,
            timeDiff = 0, // 强制PERFECT，时间差设为0
            position = transform.position
        };
        DataTransfer.judgmentQueue.Enqueue(data);

        // 播放滑动特效
        ShowJudgmentEffect(timeDiff);

        base.HandleHit();
    }

    public override void HandleMiss()
    {
        if (isMissed) return;
        isMissed = true;

        Image headImage = noteHead.GetComponent<Image>();
        Image tailImage = noteTail.GetComponent<Image>();

        if (headImage != null)
        {
            headImage.sprite = miss;
        }

        if (tailImage != null)
        {
            tailImage.sprite = miss;
        }


        DataTransfer.activeNotes.Remove(this);
        base.HandleMiss();
        //ReturnToPool();
    }

    //计算拖动音符的命中精度
    float CalculateHitAccuracy()
    {
        return base.CalculateTimingAccuracy();
    }

}
