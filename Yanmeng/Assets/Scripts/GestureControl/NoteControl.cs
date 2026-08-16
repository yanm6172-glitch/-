using System;
using UnityEngine;
using UnityEngine.UI;
using static DataTransfer;

public class NoteControl : MonoBehaviour
{
    // �¼�����
    public event Action<NoteControl, float> OnNoteHit; // ����������ʵ����ʱ���
    public event Action<NoteControl> OnNoteMiss;
    
    /*
    #region ��������
    public string noteType;
    private float perfectThreshold = 0.05f;
    private float greatThreshold = 0.1f;
    private float normalThreshold = 0.2f;

    public float speed;          // �����ٶ�
    public bool isVertical = false;      // �Ƿ�Ϊ��ֱ����
    public int beginIndex;       // ��ʼ������
    public int endIndex;         // ���������ţ���Drag/Hold��Ҫ��
    #endregion
    */

    #region ���Ĳ���
    [SerializeField] private string noteType; 

    public float Speed { get; set; } 
    public bool IsVertical { get; private set; } // ��������
    public int BeginIndex { get; private set; }
    public int EndIndex { get; private set; }
    public string Type => noteType;
    public float BeginTime { get; private set; } // ������ʼʱ��
    public float EndTime { get; private set; }   // ��������ʱ��
    #endregion

    #region �˶�����
    private Vector3 startPosition;
    private Vector3 targetPosition;
    private float journeyLength;
    private float startTime;
    public bool isActive = true;
    #endregion

    #region �������
    //public SpriteRenderer spriteRenderer;
    public Image image;
    private CircleCollider2D noteCollider;
    #endregion

    #region ��Ч����
    [SerializeField] private GameObject perfectEffect;
    [SerializeField] private GameObject greatEffect;
    [SerializeField] private GameObject normalEffect;
    public GameObject missEffect;
    public GameObject tapHitEffectPrefab;
    [SerializeField] public Sprite miss;
    [SerializeField] public Sprite original;
    #endregion

    #region ʱ���ж�ϵͳ
    private float _spawnTime;            // ��������ʱ��
    public float _expectedHitTime;      // Ԥ������ʱ�䣨�����ж��ߵ�ʱ�䣩
    private const float MissThreshold = 0.2f;
    #endregion

    protected bool inJudgmentRange = false;
    public bool isMissed = false;

    /*
    #region �����������
    public float continueFallTime = 0.2f;
    private float fallTimer = 0.0f; // ���ڼ�ʱ
    private bool hasReachedTarget = false;
    #endregion

    // Hold����ר��
    private float holdDuration;
    private float holdStartTime;
    private bool isHolding = false;
    */

    void Awake()
    {
        //gameObject.tag = "Note";
        image =GetComponent<Image>();
        noteCollider = GetComponent<CircleCollider2D>();
        if(image != null) 
            original=image.sprite;

        // �Զ�������ײ���С
        RectTransform rect = GetComponent<RectTransform>();
        CircleCollider2D collider = GetComponent<CircleCollider2D>();
        if (collider != null)
        {
            collider.radius = Mathf.Max(rect.sizeDelta.x, rect.sizeDelta.y) / 2;
        }
    }
    public void OnEnable() => DataTransfer.activeNotes.Add(this);
    private void OnDisable() => DataTransfer.activeNotes.Remove(this);

    // =======================
    // �����ƶ�
    // =======================

    // ��ʼ����������
    public virtual void InitializeNote(float speed, bool isVertical, int beginIndex, int endIndex, float beginTime, float endTime)
    {
        Speed = speed;
        IsVertical = isVertical;
        BeginIndex = beginIndex;
        EndIndex = endIndex;
        BeginTime = beginTime;
        EndTime = endTime;

        _spawnTime = Time.time;

        // 根据判定线的实际位置计算预期命中时间
        float totalDist, distToJudge;
        if (IsVertical)
        {
            totalDist = Mathf.Abs(DataTransfer.controller.verticalEndY - DataTransfer.controller.verticalStartY);
            distToJudge = Mathf.Abs(DataTransfer.controller.verticalJudgeLineY - DataTransfer.controller.verticalStartY);
        }
        else
        {
            totalDist = Mathf.Abs(DataTransfer.controller.horizontalEndX - DataTransfer.controller.horizontalStartX);
            distToJudge = Mathf.Abs(DataTransfer.controller.horizontalJudgeLineX - DataTransfer.controller.horizontalStartX);
        }
        float judgeFraction = totalDist > 0.001f ? distToJudge / totalDist : 1f;
        _expectedHitTime = _spawnTime + DataTransfer.controller.noteFallDuration * judgeFraction;

        //Debug.Log($"������ʼ��: Speed={Speed}, IsVertical={IsVertical}, ��ʼλ��={startPosition}, Ŀ��λ��={targetPosition}");

        SetStartPosition(beginIndex);
        CalculateMovement();
        ResetNote();
        OnNoteHit += DataTransfer.controller.JudgeNoteAdapter;
    }

    private void SetStartPosition(int index)
    {
        RectTransform rectTransform = GetComponent<RectTransform>();
        Vector2 spawnPos = DataTransfer.controller.CalculateSpawnPosition(index);
        rectTransform.anchoredPosition = spawnPos;

        // 添加日志
        //Debug.Log($"音符{index}初始位置: {spawnPos} (IsVertical={IsVertical})");
    }

    // �����ƶ�·��
    void CalculateMovement()
    {
        RectTransform rectTransform = GetComponent<RectTransform>();
        startPosition = rectTransform.anchoredPosition;
        targetPosition = CalculateTargetPosition();
        journeyLength = Vector3.Distance(startPosition, targetPosition);
        startTime = Time.time;

        //Debug.Log($"·������: start={startPosition}, target={targetPosition}, �ܳ�={journeyLength}");
    }

    // �������ͼ���Ŀ��λ�ã���������������д��
    protected virtual Vector3 CalculateTargetPosition()
    {
        gameController controller = DataTransfer.controller;
        RectTransform rectTransform = GetComponent<RectTransform>();

        if (IsVertical)
        {
            // ��ֱ�����Y����ʼλ�õ��յ㣬X���ֹ��λ��
            return new Vector3(
                rectTransform.anchoredPosition.x,
                controller.verticalEndY,
                0
            );
        }
        else
        {
            // ˮƽ�����X����ʼλ�õ��յ㣬Y���ֹ��λ��
            return new Vector3(
                controller.horizontalEndX,
                rectTransform.anchoredPosition.y,
                0
            );
        }
    }

    public void Update()
    {
        if (DataTransfer.isPaused || !isActive) return;

        UpdateMovement();

        // ����Ƿ����/�뿪�ж�����
        RectTransform rectTransform = GetComponent<RectTransform>();
        float distanceToLine = IsVertical ?
            Mathf.Abs(rectTransform.anchoredPosition.y - DataTransfer.controller.verticalJudgeLineY) :
            Mathf.Abs(rectTransform.anchoredPosition.x - DataTransfer.controller.horizontalJudgeLineX);

        float judgmentRange;
        if (Type=="double") judgmentRange = DataTransfer.GameParams.doubleJudgmentRange;
        else judgmentRange = DataTransfer.GameParams.sigleJudgmentRange;

        //Debug.Log(inJudgmentRange);
        if (!inJudgmentRange && distanceToLine <= judgmentRange)
        {
            EnterJudgmentRange();
        }
        else if (inJudgmentRange && distanceToLine > judgmentRange)
        {
            ExitJudgmentRange();
        }

        CheckAutoMiss();

        if (isMissed && IsOutOfScreen())
        {
            ReturnToPool();
        }
    }

    // �����ж�����
    protected virtual void EnterJudgmentRange()
    {
        inJudgmentRange = true;
        DataTransfer.activeNotes.Add(this);
        // ������Ϣ����ʾ��ǰ����λ�����ж��ߵľ���
        RectTransform rt2 = GetComponent<RectTransform>();
        float distanceToLine = IsVertical ?
            Mathf.Abs(rt2.anchoredPosition.y - DataTransfer.controller.verticalJudgeLineY) :
            Mathf.Abs(rt2.anchoredPosition.x - DataTransfer.controller.horizontalJudgeLineX);
        Debug.Log($"���������ж�����: {Type} at {rt2.anchoredPosition}, �����ж���: {distanceToLine:F2}px");
    }

    // �뿪�ж�����
    protected virtual void ExitJudgmentRange()
    {
        inJudgmentRange = false;
        DataTransfer.activeNotes.Remove(this);
        if (!isMissed)
        {
            HandleMiss();
        }
    }

    // �����ƶ����͸���λ��
    public void UpdateMovement()
    {
        //Debug.Log($"UpdateMovement����: isActive={isActive}, journeyLength={journeyLength}, Speed={Speed}");
        if (DataTransfer.isPaused) return;

        if (journeyLength > 0)
        {
            float distCovered = (DataTransfer.isPaused ? 0 : (Time.time - startTime)) * Speed;
            float fraction = distCovered / journeyLength;
            //transform.position = Vector3.Lerp(startPosition, targetPosition, fraction);

            RectTransform rectTransform = GetComponent<RectTransform>();
            rectTransform.anchoredPosition =
                Vector3.Lerp(startPosition, targetPosition, fraction);

            // �������
            //Debug.Log($"Moving: {rt2.anchoredPosition}, Fraction: {fraction}");
            if (fraction >= 1f)
            {
                Debug.Log("�ƶ���ɣ��Զ�Miss");
                HandleMiss();
            }
        }
        else
        {
            if (Speed > 0)
            {
                RectTransform rtFallback = GetComponent<RectTransform>();
                rtFallback.anchoredPosition += IsVertical
    ? new Vector2(-Speed * Time.deltaTime, 0)
    : new Vector2(0, -Speed * Time.deltaTime);
            }
            else
            {
                Debug.Log("speed<=0");
            }
        }
    }

    // ����Ƿ񳬳���Ļ��Χ���Զ�Miss��
    public void CheckAutoMiss()
    {
        gameController controller = DataTransfer.controller;
        RectTransform rt = GetComponent<RectTransform>();
        if (IsVertical)
        {
            if (rt.anchoredPosition.y < controller.verticalJudgeLineY)
            {
                HandleMiss();
            }
        }
        else
        {
            if (rt.anchoredPosition.x > controller.horizontalJudgeLineX)
            {
                HandleMiss();
            }
        }
    }

    // =======================
    // ��������
    // =======================
    protected void ReturnToPool()
    {
        //if (IsOutOfScreen())
        //{
        noteCollider.enabled = true;
        image.sprite = original;
        isActive = true;
        isMissed = false;
  
        gameObject.SetActive(false);
        //}
    }

    public void ResetNote()
    {
        if(image==null)
            image = GetComponent<Image>();
        image.sprite = original; 
        
        transform.localScale =new Vector3(3f,3f,3f);

        if (noteCollider == null)
            noteCollider = GetComponent<CircleCollider2D>();
        noteCollider.enabled = true;
        isActive = true;
        isMissed = false;

        SetStartPosition(BeginIndex);
        GetComponent<RectTransform>().anchoredPosition = startPosition;
    }

    // =======================
    // �ж��߼���������ʵ�֣�
    // =======================

    // 检测鼠标/触摸是否命中该音符
    public virtual bool CheckHit(Vector2 inputPos, TouchPhase phase)
    {
        if (isMissed) return false;

        RectTransform rectTransform = GetComponent<RectTransform>();
        Canvas parentCanvas = GetComponentInParent<Canvas>();

        // 使用 RectTransformUtility 将屏幕坐标转换为 Canvas 本地坐标
        Vector2 localPoint;
        if (parentCanvas != null)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                parentCanvas.GetComponent<RectTransform>(),
                inputPos,
                parentCanvas.worldCamera,  // Screen Space Overlay 时为 null
                out localPoint
            );
        }
        else
        {
            // 回退：使用 anchoredPosition
            localPoint = rectTransform.anchoredPosition;
        }

        // 计算鼠标在 Canvas 本地空间中的位置与音符 anchoredPosition 的距离
        float distance = Vector2.Distance(localPoint, rectTransform.anchoredPosition);

        // 命中半径：考虑 localScale 放大后的实际视觉尺寸
        float scaleFactor = Mathf.Max(transform.localScale.x, transform.localScale.y);
        float hitRadius = Mathf.Max(rectTransform.sizeDelta.x, rectTransform.sizeDelta.y) * scaleFactor / 2f;

        if (Type == "double")
        {
            hitRadius = 120f;  // 双击音符给予更大的判定范围
        }

        // 最小命中半径，防止太小
        if (hitRadius < 50f) hitRadius = 50f;

        Debug.Log($"[CheckHit] type={Type} localPoint={localPoint} anchoredPos={rectTransform.anchoredPosition} distance={distance:F1} radius={hitRadius:F1} result={distance <= hitRadius}");

        return distance <= hitRadius;
    }

    // ���������߼�
    public virtual void HandleHit() {
        //// ��ʾ�����Ч
        //if (tapHitEffectPrefab != null)
        //{
        //    // ȷ�� Canvas ����
        //    if (DataTransfer.controller.canvas != null)
        //    {
        //        RectTransform rectTransform = GetComponent<RectTransform>();
        //        Vector3 screenPosition = rectTransform.position;
        Debug.Log("命中"+this.gameObject.name);
        // 触发命中事件（事件会调用 JudgeNoteAdapter -> JudgeNote，处理评分、特效和回池）
        float timeDiff = CalculateTimingAccuracy();
        OnNoteHit?.Invoke(this, timeDiff);

        // 确保从活动列表中移除（JudgeNote 中的 ReturnNoteToPool 已处理，此处作兜底）
        if (DataTransfer.activeNotes.Contains(this))
        {
            DataTransfer.activeNotes.Remove(this);
        }
}

    // ����Miss�߼�
    public virtual void HandleMiss()
    {
        if (isMissed) return;
        isMissed = true;
        RectTransform rt2 = GetComponent<RectTransform>();
        Debug.Log($"音符Miss: 类型={Type}, 当前位置={rt2.anchoredPosition}, 时间={Time.time}");

        //if (noteCollider == null)
        //    noteCollider = GetComponent<CircleCollider2D>();
        //if (image == null)
        //    image = GetComponent<Image>();

        if (noteCollider != null) noteCollider.enabled = false;
        if(image!=null)
            image.sprite = miss;

        if (image.sprite == miss)
        {
            // ����ԭʼ���ű���
            Vector3 originalScale = transform.localScale;

            if (Type == "tap"|| Type == "flick")
            {
                
                // �����µ����ű���
                transform.localScale = new Vector3(
                    originalScale.x * 2f,
                    originalScale.y * 2f,
                    originalScale.z
                );
            }
            else if(Type == "double")
            {
                // �����µ����ű���
                transform.localScale = new Vector3(
                    originalScale.x * 1.7f,
                    originalScale.y * 1.7f,
                    originalScale.z
                );
            }
        }

        OnNoteMiss?.Invoke(this);
        DataTransfer.controller.HandleNoteMiss(this);
    }

    // ����Ƿ񳬳���Ļ
    public bool IsOutOfScreen()
    {
        if (DataTransfer.controller == null)
            return false;

        Rect canvasBounds = DataTransfer.controller.GetCanvasBounds();
        RectTransform rt = GetComponent<RectTransform>();
        Vector2 notePos = rt.anchoredPosition;
        float buffer = 50f;

        if (IsVertical)
        {
            return notePos.y < canvasBounds.yMin - buffer;
        }
        else
        {
            return notePos.x > canvasBounds.xMax + buffer;
        }
    }


    // =======================
    // ��Ч����
    // =======================
    protected void EnqueueJudgment()
    {
        float timeDiff = CalculateTimingAccuracy();
        JudgmentType judgmentType = GetJudgmentType(timeDiff);
        DataTransfer.JudgmentData data = new DataTransfer.JudgmentData
        {
            note = this,
            judgmentType = judgmentType,
            timeDiff = timeDiff,
            position = transform.position
        };
        DataTransfer.judgmentQueue.Enqueue(data);
    }

    // ��ȡ�ж��ȼ�
    public JudgmentType GetJudgmentType(float timeDiff)
    {
        float absDiff = Mathf.Abs(timeDiff);

        if (absDiff <= DataTransfer.GameParams.PerfectThreshold)
            return JudgmentType.Perfect;
        if (absDiff <= DataTransfer.GameParams.GreatThreshold)
            return JudgmentType.Great;
        if (absDiff <= DataTransfer.GameParams.NormalThreshold)
            return JudgmentType.Normal;
        return JudgmentType.Miss;
    }

    // ��ʾ�ж���Ч
    public void ShowJudgmentEffect(float accuracy)
    {
        GameObject effectPrefab = GetEffectPrefab(accuracy);
        if (effectPrefab != null)
        {
            Instantiate(effectPrefab, transform.position, Quaternion.identity);
        }
    }

    // ��ȡ��Ӧ��ЧԤ����
    GameObject GetEffectPrefab(float accuracy)
    {
        if (accuracy <= DataTransfer.GameParams.PerfectThreshold)
            return perfectEffect;
        if (accuracy <= DataTransfer.GameParams.GreatThreshold)
            return greatEffect;
        return normalEffect;
    }

    public void ShowMissEffect()
    {
        if(image==null)
            image = GetComponent<Image>();
        image.sprite = miss;
    }

    // ����ˮƽ������꣨����/�����ã�
    protected float GetHorizontalPosition(int index)
    {
        int maxLanes = DataTransfer.controller.GetMaxLanes();
        return Mathf.Lerp(-8f, 8f, (float)index / maxLanes);
    }

    // ���㴹ֱ������꣨����/���ã�
    protected float GetVerticalPosition(int index)
    {
        int maxLanes = DataTransfer.controller.GetMaxLanes();
        return Mathf.Lerp(10f, -10f, (float)index / maxLanes);
    }

    // ����ʱ����λ���룩
    public float CalculateTimingAccuracy()
    {
        float hitTime = Time.time;       // ʵ������ʱ��
        //return Mathf.Abs(hitTime - BeginTime);

        return Mathf.Abs(hitTime - _expectedHitTime);
       
    }

    /*
     void Start()
    {
        startTime = Time.time;
        InitializeMovement();
    }

    // ��ʼ���˶�����
    void InitializeMovement()
    {
        if (isVertical)// ��ֱ��������������/�
        {
            startPos = transform.position;
            endPos = new Vector3(targetX, startPos.y, startPos.z);
        }
        else // ˮƽ��������������/���ã�
        {
            startPos = transform.position;
            endPos = new Vector3(startPos.x, targetY, startPos.z);
        }

        // Drag���ͣ��������们��·��
        if (endIndex != beginIndex)
        {
            float startLane = beginIndex;
            float endLane = endIndex;
            if (isVertical)// ��ֱ���򻬶���Y������仯
            {
                startPos.y = Mathf.Lerp(10, -10, startLane / GetMaxLanes());
                endPos.y = Mathf.Lerp(10, -10, endLane / GetMaxLanes());
            }
            else// ˮƽ���򻬶���X������仯
            {
                startPos.x = Mathf.Lerp(-8, 8, startLane / GetMaxLanes());
                endPos.x = Mathf.Lerp(-8, 8, endLane / GetMaxLanes());
            }
        }
        journeyLength = Vector3.Distance(startPos, endPos);
    }

    // �����������ͻ�ȡ�������
    int GetMaxLanes()
    {
        switch (DataTransfer.controller.selectedInstrument)
        {
            case gameController.Instrument.Guzheng: return 13;
            case gameController.Instrument.Pipa: return 4;
            case gameController.Instrument.Erhu: return 6;
            case gameController.Instrument.Xiao: return 5;
            default: return 1;
        }
    }
    void Update()
    {
        
        // ���������ĵ�ǰλ��
        float newY = transform.position.y - speed * DataTransfer.deltaTime;

        //ֹͣ����
        if (newY <= targetY)
        {
            newY = targetY;
            Destroy(gameObject); 
        }

        // ����������λ��
        transform.position = new Vector3(transform.position.x, newY, transform.position.z);
   

        // �����û�е���Ŀ��λ��
        if (!hasReachedTarget)
        {
            float newY = transform.position.y - speed * DataTransfer.deltaTime;

            // ����Ƿ񵽴�Ŀ��λ��
            if (newY <= targetY)
            {
                newY = targetY; // ȷ���������������ͷ
                hasReachedTarget = true; // ����ѵ���Ŀ��λ��
            }

            transform.position = new Vector3(transform.position.x, newY, transform.position.z);
        }
        else
        {
            // ����Ѿ�����Ŀ��λ�ã���������0.2��
            fallTimer += DataTransfer.deltaTime;

            // �ڼ��������0.2���ڣ�����������ԭ�ٶ�����
            if (fallTimer < continueFallTime)
            {
                float newY = transform.position.y - speed * DataTransfer.deltaTime;
                transform.position = new Vector3(transform.position.x, newY, transform.position.z);
            }
            else
            {
                // 0.2�����������
                Destroy(gameObject);
            }

        }
         
    }
    */

}
