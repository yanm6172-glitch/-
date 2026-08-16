using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using static DataTransfer;

// ���������
public class TouchInput : MonoBehaviour
{
    /*
    //��ʾ�ߣ�Ԥ���壩
    public GameObject touchLineX;
    public GameObject touchLineY;

    List<float> tap = new List<float>();//���
    List<float> touch = new List<float>();//����
    List<float> flick = new List<float>();//����
    List<float> lastTouch = new List<float>();

    List<GameObject> touchPositions = new List<GameObject>();

    public bool useYCoordinate = false;
    */

    
    /*
    void Update()
    {
        clearTouchData();
        GetTouchData();
        GetmouseData();
        ShowTouchPositions();
    }

    void clearTouchData()
    {
        lastTouch=new List<float>(touch);
        touch.Clear();
        tap.Clear();
        flick.Clear();
    }

    void GetTouchData()
    {
        foreach (Touch finger in Input.touches)
        {
            Ray ray = Camera.main.ScreenPointToRay(finger.position);
            RaycastHit hit;
            if (Physics.Raycast(ray, out hit))
            {
                float position = useYCoordinate ? hit.point.y : hit.point.x;
                //���
                if (finger.phase == TouchPhase.Began)
                {
                    tap.Add(position);
                }
                //����
                touch.Add(position);
                //����
                if (!lastTouch.Contains(position) && finger.phase == TouchPhase.Moved)
                {
                    flick.Add(position);
                }
            }
        }
    }

    void GetmouseData()
    {
        Ray ray1 = Camera.main.ScreenPointToRay(Input.mousePosition);
        RaycastHit2D hit1 = Physics2D.Raycast(ray1.origin, ray1.direction);
        if (hit1.collider != null)
        {
            float position = useYCoordinate ? hit1.point.y : hit1.point.x;
            if (Input.GetMouseButton(0))
            {
                tap.Add(position);
                lastTouch.Clear();
                lastTouch.Add(position);
            }

            if (Input.GetMouseButton(0))
            {
                touch.Add(position);

                // ��⻬��
                if (lastTouch.Count > 0)
                {
                    float distance = Mathf.Abs(position - lastTouch[0]);
                    if (distance > 0.1f) // ����������ֵ
                    {
                        flick.Add(position);
                        Debug.Log("You flicked me");
                    }
                }
            }
        }

    }

    void ShowTouchPositions()
    {
        GameObject touchLine = useYCoordinate ? touchLineY : touchLineX;
        for (int i = 0; i < touch.Count; i++)
        {
            if (i == touchPositions.Count)
            {
                GameObject obj = Instantiate(touchLine, new Vector3(0, 0,-1f), Quaternion.identity);
                touchPositions.Add(obj);
            }

            //�����������ֻ����
            Vector3 pos = touchPositions[i].transform.position;
            pos.x = useYCoordinate ? 0 : touch[i]; 
            pos.y = useYCoordinate ? touch[i] : 0;
            touchPositions[i].transform.position = pos;
        }
        while (touchPositions.Count > touch.Count)
        {
            Destroy(touchPositions[touchPositions.Count - 1]);
            touchPositions.RemoveAt(touchPositions.Count - 1);
        }
    }

    void JudgeNote()
    {
        for (int i = 0; i < DataTransfer.tapJudgeList.Count; i++)
        {
            for (int j = 0; j < tap.Count; j++)
            {
                if (DataTransfer.tapJudgeList[i].JudgeNote(tap[j]))
                {
                    tap.Remove(tap[j]);
                }
            }
        }
        for (int i = 0; i < DataTransfer.dragJudgeList.Count; i++)
        {
            for (int j = 0; j < touch.Count; j++)
            {
                if (DataTransfer.dragJudgeList[i].JudgeNote(touch[j]))
                {
                    touch.Remove(touch[j]);
                }
            }
        }
        for (int i = 0; i < DataTransfer.flickJudgeList.Count; i++)
        {
            for (int j = 0; j < flick.Count; j++)
            {
                if (DataTransfer.flickJudgeList[i].JudgeNote(flick[j]))
                {
                    flick.Remove(flick[j]);
                }
            }
        }
        for (int i = 0; i < DataTransfer.headJudgeList.Count; i++)
        {
            for (int j = 0; j < tap.Count; j++)
            {
                if (DataTransfer.headJudgeList[i].HeadJudge(tap[j]))
                {
                    tap.Remove(tap[j]);
                }
            }
        }
        for (int i = 0; i < DataTransfer.holdingJudgeList.Count; i++)
        {
            for (int j = 0; j < touch.Count; j++)
            {
                if (DataTransfer.holdingJudgeList[i].HoldingJudge(touch[j]))
                {
                    touch.Remove(touch[j]);
                }
            }
        }
    }
    */

  
    // ��ʾ������
    [Header("Touch Indicators")]
    [SerializeField] private GameObject horizontalIndicatorPrefab; // X�᷽����ʾ��
    [SerializeField] private GameObject verticalIndicatorPrefab;   // Y�᷽����ʾ��
    [SerializeField] private float indicatorZPosition = -1f;       // Z��λ��
    [SerializeField] private float flickThreshold = 0.1f;          // �����ж���ֵ
    public GameObject canvas;

    // �������
    private readonly List<Vector2> activeTouches = new List<Vector2>();
    private readonly List<GameObject> touchIndicators = new List<GameObject>();

    void Update()
    {
        if (DataTransfer.isPaused) return;

        //activeTouches.Clear();// ��մ�������
        //ProcessInputSources();
        //foreach (Vector2 touchPos in activeTouches)
        //{
        //    ProcessNoteJudgment(touchPos);
        //}

        // ������������
        foreach (Touch touch in Input.touches)
        {
            ProcessNoteJudgment(touch.position, touch.phase);
            UpdateActiveTouches(touch.position, touch.phase);
        }

        // 鼠标输入兼容（PC 调试用）
        if (Input.GetMouseButtonDown(0))
        {
            ProcessNoteJudgment(Input.mousePosition, TouchPhase.Began);
            UpdateActiveTouches(Input.mousePosition, TouchPhase.Began);
        }
        else if (Input.GetMouseButton(0))
        {
            ProcessNoteJudgment(Input.mousePosition, TouchPhase.Moved);
            UpdateActiveTouches(Input.mousePosition, TouchPhase.Moved);
        }
        else if (Input.GetMouseButtonUp(0))
        {
            ProcessNoteJudgment(Input.mousePosition, TouchPhase.Ended);
            UpdateActiveTouches(Input.mousePosition, TouchPhase.Ended);
        }

        //UpdateTouchIndicators();
        ProcessJudgmentQueue();
    }

    // ���»��������
    void UpdateActiveTouches(Vector2 position, TouchPhase phase)
    {
        switch (phase)
        {
            case TouchPhase.Began:
                activeTouches.Add(position);
                break;
            case TouchPhase.Moved:
                if (activeTouches.Count > 0)
                    activeTouches[activeTouches.Count - 1] = position;
                break;
            case TouchPhase.Ended:
                if (activeTouches.Count > 0)
                    activeTouches.RemoveAt(activeTouches.Count - 1);
                break;
        }
    }

    //====================================
    // ������������Դ���ƶ��˴���+PC����꣩
    //====================================

    //void ProcessInputSources()
    //{
    //    ProcessMobileTouches();
    //    ProcessMouseInput();
    //}

    //// �ƶ��˴�������
    //void ProcessMobileTouches()
    //{
    //    foreach (Touch touch in Input.touches)
    //    {
    //        PointerEventData pointerData = new PointerEventData(EventSystem.current)
    //        {
    //            position = touch.position
    //        };

    //        List<RaycastResult> results = new List<RaycastResult>();
    //        EventSystem.current.RaycastAll(pointerData, results);

    //        foreach (RaycastResult result in results)
    //        {
    //            Debug.Log("Touched UI element: " + result.gameObject.name);
    //            HandleUIElementInteraction(touch.phase, touch.position, result.gameObject);
                
    //        }
    //        //Ray ray = Camera.main.ScreenPointToRay(touch.position);
    //        //RaycastHit hit;
    //        //if (Physics.Raycast(ray, out hit))
    //        //{
    //        //    Vector2 touchPos = new Vector2(hit.point.x, hit.point.y);
    //        //    HandleTouchPhase(touch.phase, touchPos);
    //        //    CheckNoteInteraction(touchPos);
    //        //}
    //        ////Vector2 touchPos = Camera.main.ScreenToWorldPoint(touch.position);
    //        ////HandleTouchPhase(touch.phase, touchPos);

    //        ////CheckNoteInteraction(touchPos);
    //    }
    //}

    //// PC��������루���ڼǵ�ɾ��
    //void ProcessMouseInput()
    //{
    //    if (Input.GetMouseButton(0))
    //    {
    //        Vector2 mousePos = Input.mousePosition;
    //        ProcessNoteJudgment(mousePos);

    //        // ���´���ָʾ��
    //        if (activeTouches.Count == 0) activeTouches.Add(mousePos);
    //        else activeTouches[0] = mousePos;
    //    }
    //    else if (activeTouches.Count > 0)
    //    {
    //        activeTouches.Clear();
    //    }
    //    //if (Input.GetMouseButtonDown(0) || Input.GetMouseButton(0) || Input.GetMouseButtonUp(0))
    //    //{
    //    //    PointerEventData pointerData = new PointerEventData(EventSystem.current)
    //    //    {
    //    //        position = Input.mousePosition
    //    //    };

    //    //    List<RaycastResult> results = new List<RaycastResult>();
    //    //    EventSystem.current.RaycastAll(pointerData, results);

    //    //    foreach (RaycastResult result in results)
    //    //    {

    //    //        Debug.Log("Clicked UI element: " + result.gameObject.name);
    //    //        TouchPhase phase = Input.GetMouseButtonDown(0) ? TouchPhase.Began :
    //    //                               Input.GetMouseButtonUp(0) ? TouchPhase.Ended : TouchPhase.Moved;
    //    //        HandleUIElementInteraction(phase, Input.mousePosition, result.gameObject);

    //    //    }

    //    //}

    //}

    // ���� UI Ԫ�صĽ���
   
    //void HandleUIElementInteraction(TouchPhase phase, Vector2 position, GameObject uiElement)
    //{
    //    switch (phase)
    //    {
    //        case TouchPhase.Began:
    //            activeTouches.Add(position);
    //            //DetectFlickGesture(position);
    //            GameObject indicator = CreateNewIndicator();
    //            touchIndicators.Add(indicator);
    //            UpdateIndicatorPosition(indicator, position);
    //            //HandleUIElementClick(uiElement);

    //            //if (uiElement.CompareTag("Note"))
    //            //{
    //            //    NoteControl noteControl = uiElement.GetComponent<NoteControl>();
    //            //    if (noteControl != null)
    //            //    {
    //            //        float timeDiff = noteControl.CalculateTimingAccuracy();
    //            //        JudgmentType judgmentType = noteControl.GetJudgmentType(timeDiff);
    //            //        DataTransfer.controller.JudgeNote(noteControl, judgmentType, timeDiff);
    //            //    }
    //            //}

    //            break;

    //        case TouchPhase.Moved:
    //            UpdateExistingTouch(position);
    //            DetectFlickGesture(position);
    //            //HandleUIElementDrag(uiElement, position);
                
    //            if (touchIndicators.Count > 0)
    //            {
    //                UpdateIndicatorPosition(touchIndicators[touchIndicators.Count - 1], position);
    //            }

    //            //// ����Ƿ���������
    //            //if (uiElement.CompareTag("Note"))
    //            //{
    //            //    NoteControl noteControl = uiElement.GetComponent<NoteControl>();
    //            //    if (noteControl != null)
    //            //    {
    //            //        float timeDiff = noteControl.CalculateTimingAccuracy();
    //            //        JudgmentType judgmentType = noteControl.GetJudgmentType(timeDiff);
    //            //        DataTransfer.controller.JudgeNote(noteControl, judgmentType, timeDiff);
    //            //    }
    //            //}

    //            break;

    //        case TouchPhase.Ended:
    //            //activeTouches.Remove(position);
    //            //HandleUIElementRelease(uiElement, position);
    //            if (activeTouches.Count > 0)
    //            {
    //                activeTouches.RemoveAt(activeTouches.Count - 1);
    //            }
    //            if (touchIndicators.Count > 0)
    //            {
    //                Destroy(touchIndicators[touchIndicators.Count - 1]);
    //                touchIndicators.RemoveAt(touchIndicators.Count - 1);
    //            }
    //            break;
    //    }
    //}


    // ���³���������λ��
    //void UpdateExistingTouch(Vector2 newPosition)
    //{
    //    if (activeTouches.Count > 0)
    //    {
    //        activeTouches[activeTouches.Count - 1] = newPosition;
    //    }
    //}

    //====================================
    // �����������
    //====================================
   
    void ProcessNoteJudgment(Vector2 inputPos, TouchPhase phase)
    {
        //Debug.Log($"��������: {inputPos}, �׶�: {phase}");
        // ʹ��UI�¼�ϵͳ���
        PointerEventData pointerData = new PointerEventData(EventSystem.current);
        pointerData.position = inputPos;

        List<RaycastResult> results = new List<RaycastResult>();
        EventSystem.current.RaycastAll(pointerData, results);

        // �洢���е�����
        List<NoteControl> hitNotes = new List<NoteControl>();
        foreach (var result in results)
        {
            Debug.Log(result.gameObject.name);
            NoteControl note = result.gameObject.GetComponent<NoteControl>();
            if (note != null)
            {
                hitNotes.Add(note);
                Debug.Log("������");
            }
            else
            {
                Debug.Log("û��NoteControl");
            }
            
        }

        // ���û������������ֱ�ӷ���
        if (hitNotes.Count == 0)
        {
            Debug.Log("û�������κ�����");
            return;
        }

        // ���������������ȼ�����Tap > DoubleTap > Flick > Drag > Hold
        hitNotes.Sort((a, b) =>
        {
            int GetPriority(NoteControl n)
            {
                if (n is TapControl && n.Type != "double") return 0;
                if (n.Type == "double") return 1;
                if (n is FlickControl) return 2;
                if (n is DragControl) return 3;
                if (n is HoldControl) return 4;
                return 5;
            }
            return GetPriority(a) - GetPriority(b);
        });

        // ����ÿ���������ж�
        foreach (NoteControl note in hitNotes)
        {
            bool hitResult = note.CheckHit(inputPos, phase);

            // ������гɹ��������ж�������ѭ��
            if (hitResult)
            {
                if (note != null && note.gameObject.activeSelf && !note.isMissed) EnqueueJudgment(note);
                Debug.Log($"��������: {note.Type}");
                return; // һ�δ���ֻ�ж�һ������
            }
        }    

        //Debug.Log($"��⵽{results.Count}��UIԪ��");
        //foreach (var r in results)
        //{
        //    Debug.Log(r.gameObject.name);
        //}
    }

    //void ProcessNoteJudgment(Vector2 inputPos)
    //{
    //    // ������ʱ�б���ֹ�޸�ԭʼ����
    //    var notesToCheck = new List<NoteControl>(DataTransfer.activeNotes);

    //    // ������������������ȣ�
    //    notesToCheck.Sort((a, b) =>
    //        Vector2.Distance(a.transform.position, inputPos)
    //        .CompareTo(Vector2.Distance(b.transform.position, inputPos))
    //    );

    //    foreach (NoteControl note in notesToCheck)
    //    {
    //        // �����ײ�����귶Χ
    //        if (note.CheckHit(inputPos))
    //        {
    //            // �ɹ��ж����Ƴ�������
    //            activeTouches.Remove(inputPos);
    //            ProcessJudgmentQueue();

    //            // �������ص�ֻƥ��һ������
    //            return;
    //        }
    //    }
    //}

    // ���ж����������У��������Ⱥ�λ�ã�
    void EnqueueJudgment(NoteControl note)
    {
        // �����������ȡʱ�����ж�����
        float timeDiff = note.CalculateTimingAccuracy();
        JudgmentType judgmentType = note.GetJudgmentType(timeDiff);
        Debug.Log($"ʱ���: {timeDiff}, �ж�����: {judgmentType}");

        // �����ж�����
        DataTransfer.JudgmentData data = new DataTransfer.JudgmentData
        {
            note = note,
            judgmentType = judgmentType,
            timeDiff = timeDiff,
            position = note.transform.position
        };

        // ���
        DataTransfer.judgmentQueue.Enqueue(data);
    }

    //====================================
    // �ж����д���
    //====================================
    void ProcessJudgmentQueue()
    {
        while (DataTransfer.judgmentQueue.Count > 0)
        {
            DataTransfer.JudgmentData data = DataTransfer.judgmentQueue.Dequeue();
            DataTransfer.controller.JudgeNote(
                note: data.note,
                judgmentType: data.judgmentType,
                timeDiff: data.timeDiff
            );
        }
    }

    //====================================
    // �÷ֺ���Ч����
    //====================================

    // ���ݾ��ȼ���÷�
    int CalculateScore(float accuracy)
    {
        if (accuracy <= DataTransfer.GameParams.PerfectThreshold)
            return DataTransfer.GameParams.PerfectScore;
        if (accuracy <= DataTransfer.GameParams.GreatThreshold)
            return DataTransfer.GameParams.GreatScore;
        return DataTransfer.GameParams.NormalScore;
    }

    // ��ʾ�ж���Ч
    void ShowJudgmentEffect(float accuracy, Vector3 position)
    {
        GameObject effectPrefab = GetEffectPrefab(accuracy);
        if (effectPrefab != null)
        {
            Instantiate(effectPrefab, position, Quaternion.identity);
        }
    }

    // ��ȡ��Ӧ��ЧԤ����
    GameObject GetEffectPrefab(float accuracy)
    {
        if (accuracy <= DataTransfer.GameParams.PerfectThreshold)
            return DataTransfer.controller.perfectEffect;
        if (accuracy <= DataTransfer.GameParams.GreatThreshold)
            return DataTransfer.controller.greatEffect;
        return DataTransfer.controller.normalEffect;
    }


    //====================================
    // ����λ��ָʾ�������ڼǵ�ɾ��
    //====================================
    //void UpdateTouchIndicators()
    //{

    //    // ��̬������ʾ������
    //    while (touchIndicators.Count < activeTouches.Count)
    //    {
    //        GameObject indicator = CreateNewIndicator();
    //        touchIndicators.Add(indicator);
    //    }

    //    // �Ƴ�������ʾ��
    //    while (touchIndicators.Count > activeTouches.Count)
    //    {
    //        Destroy(touchIndicators[^1]);
    //        touchIndicators.RemoveAt(touchIndicators.Count - 1);
    //    }

    //    // ������ʾ��λ��
    //    for (int i = 0; i < activeTouches.Count; i++)
    //    {
    //        UpdateIndicatorPosition(touchIndicators[i], activeTouches[i]);
    //    }
    //}

    //// ������ָʾ��
    //GameObject CreateNewIndicator()
    //{
    //    GameObject prefab = DataTransfer.controller.IsVerticalInstrument() ?
    //        verticalIndicatorPrefab :
    //        horizontalIndicatorPrefab;

    //    return Instantiate(
    //        prefab,
    //        Vector3.zero,
    //        Quaternion.identity,
    //        canvas.transform
    //    );
    //}

    //// ����ָʾ��λ��
    //void UpdateIndicatorPosition(GameObject indicator, Vector2 touchPos)
    //{
    //    //Vector3 newPos = indicator.transform.position;

    //    //if (DataTransfer.controller.IsVerticalInstrument())
    //    //    newPos.Set(0, touchPos.y, indicatorZPosition);
    //    //else
    //    //    newPos.Set(touchPos.x, 0, indicatorZPosition);
    //    //indicator.transform.position = newPos;

    //    // ����Ļ����ת��Ϊ Canvas ����
    //    RectTransform canvasRect = canvas.GetComponent<RectTransform>();
    //    Vector2 localPos;
    //    RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, touchPos, null, out localPos);

    //    indicator.transform.localPosition = new Vector3(localPos.x, localPos.y, indicatorZPosition);
    //}
}
