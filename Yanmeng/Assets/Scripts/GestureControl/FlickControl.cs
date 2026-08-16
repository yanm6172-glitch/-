using UnityEngine;

// 快速滑动音符控制逻辑
public class FlickControl : NoteControl
{
    //public GameObject flickEffectPrefab;
    private Vector2? lastTouchPosition = null;// 用于记录上一次触摸位置

    void Update()
    {
        if (DataTransfer.isPaused) return;

        if (!DataTransfer.activeNotes.Contains(this))
        {
            DataTransfer.activeNotes.Add(this);
        }
        base.Update();
    }
    
    public override bool CheckHit(Vector2 inputPos, TouchPhase phase)
    {
        // 只处理移动和结束事件
        if (phase != TouchPhase.Moved && phase != TouchPhase.Ended) return false;

        // 调用基础距离判定
        if (!base.CheckHit(inputPos, phase)) return false;

        // 如果是第一次触摸，记录位置
        if (lastTouchPosition == null)
        {
            lastTouchPosition = inputPos;
            return false; // 等待滑动
        }

        // 计算滑动距离
        float flickDistance = Vector2.Distance(lastTouchPosition.Value, inputPos);

        // 如果滑动距离大于阈值，则判定成功
        if (flickDistance >= DataTransfer.GameParams.FlickThreshold)
        {
            lastTouchPosition = null; // 重置触摸位置
            HandleHit();
            return true;
        }

        return false;

        //// 检查点击位置是否在判定范围内
        //float distance = DataTransfer.controller.IsVerticalInstrument() ?
        //    Mathf.Abs(transform.position.y - inputPos.y) :
        //    Mathf.Abs(transform.position.x - inputPos.x);

        //// 只要点击位置在判定范围内即可进入下一步
        //if (distance <= DataTransfer.GameParams.NormalThreshold)
        //{
        //    // 如果是第一次触摸，记录位置
        //    if (lastTouchPosition == null)
        //    {
        //        lastTouchPosition = inputPos;
        //        return false; // 等待滑动
        //    }

        //    // 计算滑动距离
        //    float flickDistance = Vector2.Distance(lastTouchPosition.Value, inputPos);

        //    // 如果滑动距离大于阈值，则判定成功
        //    if (flickDistance >= DataTransfer.GameParams.FlickThreshold)
        //    {
        //        lastTouchPosition = null; // 重置触摸位置
        //        return true;
        //    }
        //}

        //// 如果不在判定范围内或滑动距离不足，则判定失败
        //lastTouchPosition = null; // 重置触摸位置
        //return false;
    }

    public override void HandleHit()
    {
        // 计算时间差并入队判定
        float timeDiff = CalculateTimingAccuracy();
        EnqueueJudgment();

        // 播放滑动特效
        Vector2 inputPos = Camera.main.ScreenToWorldPoint(Input.mousePosition);
        Vector2 direction = (inputPos - (Vector2)transform.position).normalized;
        //GameObject effect = Instantiate(flickEffectPrefab, transform.position, Quaternion.identity);
        //effect.transform.right = direction;

        base.HandleHit();
    }

    public override void HandleMiss()
    {
        image.sprite = miss;
        DataTransfer.activeNotes.Remove(this);
        base.HandleMiss();
        //ReturnToPool();
    }

    //public bool JudgeNote(float xPosition)
    //{
    //    float x = System.Math.Abs(transform.position.x - xPosition);
    //    if (x < 1)// 点击范围
    //    {
    //        //DataTransfer.controller.GenerateEffect(myTime, transform.position.x);
    //        //DataTransfer.controller.JudgeNote(myTime);

    //        // 将判定事件加入队列
    //        DataTransfer.judgmentQueue.Enqueue(GetComponent<NoteControl>());
    //        Destroy(gameObject);
    //        return true;
    //    }
    //    return false;
    //}
    //void Miss()
    //{
    //    //生成特效
    //    DataTransfer.activeNotes.Remove(GetComponent<NoteControl>());
    //    //DataTransfer.controller.MissNote();
    //    Destroy(gameObject);
    //}
}
