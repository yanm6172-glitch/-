using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using static DataTransfer;
using TMPro;
using UnityEngine.UIElements;
using UnityEngine.SceneManagement;

public class gameController : MonoBehaviour
{
    // 乐器类型枚举
    public enum Instrument { Guzheng, Pipa, Erhu, Xiao }
    public Instrument selectedInstrument;

    // 谱面与音频
    public TextAsset chart;
    public AudioSource musicPlayer;
    private string chartPath = "BeatMap/"; // 谱面存放路径

    //音符预制体
    public GameObject tap,drag,flick,hold,doubleTap;

    //判定线坐标
    public float horizontalStartX = -500;   // 水平轨道起始X
    public float horizontalEndX = 500;      // 水平轨道终点X
    public float verticalStartY = 250;      // 竖直轨道起始Y
    public float verticalEndY = -250;       // 竖直轨道终点Y
    public float horizontalJudgeLineX = 0;   // 水平判定线X坐标
    public float verticalJudgeLineY = 0;     // 垂直判定线Y坐标

    #region UI元素
    public TMP_Text scoreText,hitCountText;//分数UI
    public TMP_Text updateScoreText;
    public GameObject perfect, great, normal;//特效UI
    public GameObject pausePanel;//暂停UI
    public GameObject endPanel;
    public UnityEngine.UI.Button pause,play,quit;
    public GameObject canvas;// 生成音符的canvas
    public UnityEngine.UI.Slider progressBar;// 游戏进度条
    public TMP_Text progressText; // 进度文本
    public Vector3 effectPosition;
    public float effectTime=0.5f;
    #endregion

    // 游戏状态参数
    public float noteFallDuration = 2.0f; // 音符下落的总时间
    private float gameTime = 0f;             // 游戏运行时间
    private bool isPlaying = false;
    private bool isPaused = false;

    // 谱面数据存储
    private List<NoteData> noteList = new List<NoteData>();
    private int currentNoteIndex = 0;

    // 分数系统
    double nowScore=0;
    double totalScore=0;
    int comboCount = 0;// 连击数
    private int maxCombo = 0;// 最大连击数
    private int totalNotes = 0;

    // 特效字段别名
    public GameObject perfectEffect => perfect;
    public GameObject greatEffect => great;
    public GameObject normalEffect => normal;

    public GameObject missEffect;

    bool gameStart =false;

    // 音符池管理
    private Dictionary<string, Queue<GameObject>> notePools = new Dictionary<string, Queue<GameObject>>();

    public static bool IsPaused => DataTransfer.isPaused;

    // 谱面数据结构
    private class NoteData
    {
        public string type;
        public float beginTime;
        public float endTime;
        public int beginIndex;
        public int endIndex;
    }

    private void Awake()
    {
        if (!string.IsNullOrEmpty(SceneLoader.selectedMusic))
        {
            // 从Resources加载谱面TextAsset
            TextAsset loadedChart = Resources.Load<TextAsset>(chartPath + SceneLoader.selectedMusic);

            if (loadedChart != null)
            {
                chart = loadedChart;
                Debug.Log($"成功加载谱面: {SceneLoader.selectedMusic}");
            }
            else
            {
                Debug.LogError($"谱面加载失败: {chartPath}{SceneLoader.selectedMusic}");
            }
        }
        else
        {
            Debug.LogWarning("未选择谱面，使用默认chart");
        }

        DataTransfer.controller = this;
        InitializeNotePools();
        LoadChart();

        // 加载音乐剪辑到 musicPlayer
        if (!string.IsNullOrEmpty(SceneLoader.selectedMusic))
        {
            AudioClip clip = Resources.Load<AudioClip>("music/" + SceneLoader.selectedMusic);
            if (clip != null && musicPlayer != null)
            {
                musicPlayer.clip = clip;
                Debug.Log("成功加载音乐: " + SceneLoader.selectedMusic);
            }
            else
            {
                Debug.LogWarning("音乐加载失败或musicPlayer为空: " + SceneLoader.selectedMusic);
            }
        }

        pause.onClick.AddListener(GamePause);//暂停
        play.onClick.AddListener(GameContinue);//继续
        quit.onClick.AddListener(QuitGame);//退出

        // 暂停音乐播放
        musicPlayer.Pause();

        // 暂停生成谱面
        gameStart = false;

        // 记录背景音乐的播放状态
        DataTransfer.isMusicPaused = true;

        // 等待2秒后开始游戏
        //StartCoroutine(StartGameAfterDelay(2.0f));

        // 改为在场景加载完成后启动游戏
        StartCoroutine(WaitForSceneLoad());

    }

    private IEnumerator WaitForSceneLoad()
    {
        // 等待场景加载完成（一帧）
        yield return null;

        // 现在开始2秒倒计时
        Debug.Log("场景加载完成，开始2秒倒计时");
        StartCoroutine(StartGameAfterDelay(2.0f));
    }


    private void Start()
    {
        //if (!gameStart)
        //{
        //    StartCoroutine(GameStart());
        //}
    }

    void Update()
    {
        /*
        if (isPlaying && !isPaused)
        {
            DataTransfer.deltaTime = Time.deltaTime;
            myTime += Time.deltaTime;
        }
        if (gameStart && !musicPlayer.isPlaying)
        {
            SceneManager.LoadScene(0);
        }
        //生成音符
        if (myTime >= timeStamps[index] - noteFallDuration)
        {
            if (index < timeStamps.Length-1) { 
                Instantiate(tap, new Vector3(notePosition[index], 20, -1), Quaternion.identity);
                // 获取音符的控制器组件
                NoteControl noteControl = tap.GetComponent<NoteControl>();

                // 设置音符的下落速度
                noteControl.speed = noteStartPosition / noteFallDuration;
                index++;
            }
        }
        */
        DataTransfer.unscaledDeltaTime = Time.unscaledDeltaTime;
        DataTransfer.deltaTime = DataTransfer.isPaused ? 0 : Time.deltaTime;

        if (!DataTransfer.isPaused)
        {
            if (isPlaying && !isPaused)
            {
                gameTime += Time.deltaTime;
                DataTransfer.deltaTime = Time.deltaTime;

                // 更新进度条
                if (noteList.Count > 0)
                {
                    float progress = Mathf.Clamp01(gameTime / noteList[noteList.Count - 1].beginTime);
                    progressBar.value = progress;
                    progressText.text = (int)(progress * 100f) + "%";
                }

                SpawnNotes();
                CheckGameEnd();
            }
        }

        //Debug.Log($"GameTime: {gameTime}, isPlaying: {isPlaying}");
    }

    //====================================
    // 管理音符生成
    //====================================

    // 初始化音符池
    void InitializeNotePools()
    {
        notePools.Clear();
        if (tap!=null)   notePools.Add("tap", new Queue<GameObject>());
        if (drag != null)   notePools.Add("drag", new Queue<GameObject>());
        if (flick != null)   notePools.Add("flick", new Queue<GameObject>());
        if (hold != null)   notePools.Add("hold", new Queue<GameObject>());
        if (doubleTap != null)   notePools.Add("double", new Queue<GameObject>());

        // 预生成音符控件并放入缓冲池
        foreach (var kvp in notePools)
        {
            string type = kvp.Key;
            int initialSize = GetInitialPoolSize(type);
            for (int i = 0; i < initialSize; i++)
            {
                GameObject note = CreateNewNote(type);
                if (note != null)
                {
                    note.SetActive(false);
                    kvp.Value.Enqueue(note);
                }
            }
        }
    }

    // 根据音符类型获取初始缓冲池大小
    int GetInitialPoolSize(string type)
    {
        return type switch
        {
            "tap" => DataTransfer.PoolConfig.InitialTapPoolSize,
            "double" => DataTransfer.PoolConfig.InitialDoublePoolSize,
            "drag" => DataTransfer.PoolConfig.InitialDragPoolSize,
            "flick" => DataTransfer.PoolConfig.InitialFlickPoolSize,
            "hold" => DataTransfer.PoolConfig.InitialHoldPoolSize,
            _ => 0
        };
    }

    //读取谱面
    void LoadChart()
    {
        if (chart == null)
        {
            Debug.LogError("Chart is null! Check SceneLoader.selectedMusic or the default chart reference.");
            return;
        }
        string[] everyLine = chart.text.Split('\n');
        bool isFirstLine = true; // 跳过标题行

        foreach (string line in everyLine)
        {
            if (string.IsNullOrEmpty(line) || isFirstLine)
            {
                isFirstLine = false; // 跳过第一行（标题）
                continue;
            }

            try
            {
                string[] everyPart = line.Split(',');
                if (everyPart.Length < 5) continue;

                NoteData data = new NoteData
                {
                    type = everyPart[0].Trim().ToLower(),
                    beginTime = Convert.ToSingle(everyPart[1]),
                    endTime = everyPart[2].Trim() != "" ? Convert.ToSingle(everyPart[2]) : 0,
                    beginIndex = Convert.ToInt32(everyPart[3]),
                    endIndex = everyPart[4].Trim() != "" ? Convert.ToInt32(everyPart[4]) : 0
                };
                noteList.Add(data);

                Debug.Log($"Type={data.type}, Begin={data.beginTime:F2}s, " +
                     $"Index={data.beginIndex}->{data.endIndex}, Duration={data.endTime - data.beginTime:F2}s");
            }
            catch (Exception e)
            {
                Debug.LogError($"解析失败 - {line}\n错误: {e.Message}");
            }

        }
        noteList.Sort((a, b) => a.beginTime.CompareTo(b.beginTime));//按照beginTime对音符进行排序
        totalNotes = noteList.Count;

        Debug.Log($"成功加载音符数量：{noteList.Count}");
    }

    // 生成音符
    void SpawnNotes()
    {
        while (currentNoteIndex < noteList.Count &&
               gameTime >= noteList[currentNoteIndex].beginTime - noteFallDuration)
        {
            NoteData data = noteList[currentNoteIndex];
            SpawnNote(data);
            currentNoteIndex++;
        }
    }

    // 从音符池中获取/创建新音符
    GameObject GetNoteFromPool(string type)
    {
        if (!notePools.ContainsKey(type))
        {
            Debug.LogError("未知的音符类型: " + type + ", 跳过生成");
            return null;
        }
        Queue<GameObject> pool = notePools[type];
        if (pool.Count > 0)
        {
            GameObject note = pool.Dequeue();
            NoteControl noteControl = note.GetComponent<NoteControl>();
            UnityEngine.UI.Image noteImage=note.GetComponent<UnityEngine.UI.Image>();
            if(noteImage!=null)
                // 打印音符的状态
                Debug.Log($"从缓冲池中取出音符: 类型={type}, 位置={note.transform.position}, 音符状态={noteControl.Type}, 是否活跃={noteControl.isActive}, 是否错过={noteControl.isMissed}，精灵={noteImage.sprite.name}");
            note.SetActive(true);
            return note;
        }
        else
        {
            GameObject note = CreateNewNote(type);
            if (note != null)
            {
                note.SetActive(true);
                NoteControl noteControl = note.GetComponent<NoteControl>();
                UnityEngine.UI.Image noteImage = note.GetComponent<UnityEngine.UI.Image>();
                if (noteImage != null)
                    // 打印音符的状态
                    Debug.Log($"从缓冲池中新建音符: 类型={type},位置={note.transform.position}, 音符状态={noteControl.Type}, 是否活跃={noteControl.isActive}, 是否错过={noteControl.isMissed}，精灵={noteImage.sprite.name}");
            }
            return note;
        }
    }

    GameObject CreateNewNote(string type)
    {
        GameObject prefab = GetPrefabByType(type);
        if (prefab == null) return null;

        GameObject note = Instantiate(prefab);
        note.SetActive(true);
        return note;
    }

    void SpawnNote(NoteData data)
    {
        //Debug.Log($"[生成] 时间:{gameTime:F2}s, 类型:{data.type}, " + $"轨道:{data.beginIndex}, 目标轨道:{data.endIndex}");

        GameObject noteObj = GetNoteFromPool(data.type);
        if (noteObj == null) return;
        noteObj.transform.SetParent(canvas.transform); // 设置父级
        noteObj.GetComponent<RectTransform>().anchoredPosition = CalculateSpawnPosition(data.beginIndex);

        float distance = IsVerticalInstrument() ?
            Mathf.Abs(verticalStartY - verticalEndY) :
            Mathf.Abs(horizontalEndX - horizontalStartX);
        float speed = distance / noteFallDuration;

        //Debug.Log($"速度计算: 距离={distance}, 时间={noteFallDuration}, 速度={speed}");

        NoteControl noteControl = noteObj.GetComponent<NoteControl>();
        noteControl.InitializeNote(
            speed: speed,
            isVertical: IsVerticalInstrument(),
            beginIndex: data.beginIndex,
            endIndex: data.endIndex,
            beginTime:data.beginTime,
            endTime:data.endTime
            );

        noteControl.OnNoteMiss += HandleNoteMiss;
        DataTransfer.activeNotes.Add(noteControl);
    }

    public Vector3 CalculateSpawnPosition(int beginIndex)
    {
        RectTransform canvasRect = canvas.GetComponent<RectTransform>();
        if (IsVerticalInstrument())
        {
            // 竖直轨道：X按轨道索引分布，Y固定为起始位置
            float x = Mathf.Lerp(
                horizontalStartX,
                horizontalEndX,
                (float)beginIndex / (GetMaxLanes() ) 
            );
            return new Vector3(x, verticalStartY, 0);
        }
        else
        {
            // 水平轨道：Y按轨道索引分布，X固定为起始位置
            float y = Mathf.Lerp(
                verticalStartY,
                verticalEndY,
                (float)beginIndex / (GetMaxLanes() )
            );
            return new Vector3(horizontalStartX, y, 0);
        }
    }

    //====================================
    // 得分计算
    //====================================

    // 判断音符
    public void JudgeNote(NoteControl note, JudgmentType judgmentType, float timeDiff)
    {
        Debug.Log($"开始判定: 类型={judgmentType}, 时间差={timeDiff:F4}s");

        int scoreValue = CalculateScore(judgmentType);
        nowScore += scoreValue; 
        totalScore = (int)nowScore; 

        UpdateCombo(judgmentType);
        UpdateScoreDisplay();

        ShowJudgmentEffect(judgmentType);
        ReturnNoteToPool(note);

        // 打印音符信息与分数信息
        Debug.Log($"音符命中信息: 类型={note.Type}, 开始时间={note.BeginTime}, 结束时间={note.EndTime}, 轨道编号={note.BeginIndex}->{note.EndIndex}");
        Debug.Log($"分数信息: 判定类型={judgmentType}, 时间差={timeDiff:F2}s, 获得分数={scoreValue}, 总分={totalScore}, 连击={comboCount}");
    }
    public void JudgeNoteAdapter(NoteControl note, float timeDiff)
    {
        JudgmentType judgmentType = note.GetJudgmentType(timeDiff); // 根据时间差计算判定类型
        JudgeNote(note, judgmentType, timeDiff);
    }

    // 统计分数
    int CalculateScore(JudgmentType judgmentType)
    {
        float baseScore = totalNotes > 0 ? 900f / totalNotes : 10f; // 基础Note分数
        return judgmentType switch
        {
            JudgmentType.Perfect => (int)(baseScore * 1),
            JudgmentType.Great => (int)(baseScore * 0.85f),
            JudgmentType.Normal => (int)(baseScore * 0.6f),
            _ => 0 // Miss
        };
    }

    // 更新连击
    void UpdateCombo(JudgmentType judgmentType)
    {
        if (judgmentType == JudgmentType.Miss)
        {
            comboCount = 0;
        }
        else
        {
            comboCount++;
            maxCombo = Mathf.Max(maxCombo, comboCount);
        }
        UpdateComboDisplay();
    }

    // 连击判定
    void UpdateComboDisplay()
    {
        hitCountText.gameObject.SetActive(comboCount >= 3);// 连击数≥3时显示
        hitCountText.text = $"连击数：{comboCount.ToString()}";
    }

    public void HandleNoteMiss(NoteControl note)
    {
        comboCount = 0;
        //note.ShowMissEffect();
        //ReturnNoteToPool(note);
        UpdateComboDisplay();

        // 显示 Miss 效果
        if (DataTransfer.controller.missEffect != null && canvas != null)
        {
            GameObject missEffectInstance = Instantiate(DataTransfer.controller.missEffect, effectPosition, Quaternion.identity, canvas.transform);
            if (missEffectInstance != null)
            {
                missEffectInstance.SetActive(true);
                Destroy(missEffectInstance, effectTime);
            }
        }

        // 确保音符不在活动列表中
        if (DataTransfer.activeNotes.Contains(note))
        {
            DataTransfer.activeNotes.Remove(note);
        }
    }

    void DestroyMissEffect()
    {
        // 销毁 Miss 效果
        GameObject[] missEffects = GameObject.FindGameObjectsWithTag("MissEffect");
        foreach (GameObject effect in missEffects)
        {
            Destroy(effect);
        }
    }

    void ReturnNoteToPool(NoteControl note)
    {
        if (note == null || note.gameObject == null) return;

        Debug.Log($"回收音符: {note.Type}, 时间={Time.time}");
        note.ResetNote();

        // 确保音符不在活动列表中
        if (DataTransfer.activeNotes.Contains(note))
        {
            DataTransfer.activeNotes.Remove(note);
        }

        if (note.image != null)
        {
            note.image.sprite = note.original; // 恢复为原始精灵
        }

        string typeKey = note.Type.ToLower();
        if (notePools.ContainsKey(typeKey))
        {
            notePools[typeKey].Enqueue(note.gameObject);
        }
        else
        {
            Debug.LogWarning("音符类型不存在于对象池: " + typeKey);
        }

        Debug.Log($"禁用音符: {note.Type}, 位置={note.transform.position}, 时间={Time.time}");
        if (note.gameObject.activeSelf)
        {
            note.gameObject.SetActive(false);
        }
        
    }


    void CheckGameEnd()
    {
        if (noteList.Count == 0)
        {
            Debug.LogWarning("谱面数据为空");
            return;
        }

        bool isMusicEnd = !musicPlayer.isPlaying || (musicPlayer.clip != null && gameTime >= musicPlayer.clip.length);
        bool isNotesFinished = noteList.Count > 0 &&
                         currentNoteIndex >= noteList.Count &&
                         DataTransfer.activeNotes.Count == 0 &&
                         gameTime >= noteList[noteList.Count - 1].beginTime + 0.5f;

        if (isNotesFinished || isMusicEnd)
        {
            endPanel.SetActive(true);
            isPlaying = false;

            // 计算连击分
            int comboScore = totalNotes > 0 ? Mathf.RoundToInt(maxCombo / (float)totalNotes * 100) : 0;
            totalScore += comboScore;

            scoreText.text = $"总分：{totalScore.ToString()}";
            // 更新分数显示
            UpdateScoreDisplay();
            //SceneManager.LoadScene("ResultScene");
        }
    }

    void UpdateScoreDisplay()
    {
        if (updateScoreText != null)
        {
            updateScoreText.text = totalScore.ToString();
            updateScoreText.ForceMeshUpdate(); // 强制立即刷新
        }

        if (hitCountText != null)
        {
            hitCountText.text = $"连击数：{ comboCount.ToString()}";
            hitCountText.gameObject.SetActive(comboCount > 0);
            hitCountText.ForceMeshUpdate();
        }
    }

    void ShowJudgmentEffect(JudgmentType judgmentType)
    {
        GameObject effectPrefab = judgmentType switch
        {
            JudgmentType.Perfect => perfect,
            JudgmentType.Great => great,
            JudgmentType.Normal => normal,
            _ => null
        };

        if (effectPrefab != null && canvas != null)
        {
            GameObject effectInstance = Instantiate(effectPrefab, effectPosition, Quaternion.identity, canvas.transform);
            if (effectInstance != null)
            {
                effectInstance.SetActive(true);
                Destroy(effectInstance, effectTime);
            }
        }
    }

    void DestroyEffect()
    {
        // 销毁所有效果
        GameObject[] effects = GameObject.FindGameObjectsWithTag("JudgmentEffect");
        foreach (GameObject effect in effects)
        {
            Destroy(effect);
        }
    }

    public Rect GetCanvasBounds()
    {
        if (canvas == null) return new Rect();

        RectTransform rectTransform = canvas.GetComponent<RectTransform>();
        Vector2 size = rectTransform.rect.size;
        Vector2 center = rectTransform.rect.center;

        return new Rect(
            center.x - size.x / 2,
            center.y - size.y / 2,
            size.x,
            size.y
        );
    }

    //====================================
    // 暂停/继续功能
    //====================================
    public void GamePause()
    {
        DataTransfer.isPaused = true;
        DataTransfer.isMusicPaused = true;
        Time.timeScale = 0;
        musicPlayer.Pause();
        pausePanel.SetActive(true);
    }

    public void GameContinue()
    {
        DataTransfer.isPaused = false;
        DataTransfer.isMusicPaused = false;
        Time.timeScale = 1;
        musicPlayer.Play();
        pausePanel.SetActive(false);
    }

    public void QuitGame()
    {
        Time.timeScale = 1;
        //endPanel.SetActive(true);
        SceneManager.LoadScene("Home");
    }

    // 辅助方法
    public bool IsVerticalInstrument()
    {
        if(selectedInstrument == Instrument.Erhu ||selectedInstrument == Instrument.Xiao)
            return true;
        return false;
    }

        

    public int GetMaxLanes() => selectedInstrument switch
    {
        Instrument.Guzheng => 13,
        Instrument.Pipa => 4,
        Instrument.Erhu => 6,
        Instrument.Xiao => 5,
        _ => 1
    };

    GameObject GetPrefabByType(string type) => type.ToLower() switch
    {
        "tap" => tap,
        "drag" => drag,
        "flick" => flick,
        "hold" => hold,
        "double" => doubleTap,
        _ => null
    };
    private IEnumerator StartGameAfterDelay(float delay)
    {
        yield return new WaitForSeconds(delay);

        // 播放音乐
        musicPlayer.Play();

        // 开始生成谱面
        gameStart = true;

        // 恢复背景音乐的播放状态
        DataTransfer.isMusicPaused = false;

        // 开始游戏
        //StartCoroutine(GameStart());
        endPanel.SetActive(false);
        pausePanel.SetActive(false);

        isPlaying = true;
    }

    IEnumerator GameStart()
    {
        endPanel.SetActive(false); 
        pausePanel.SetActive(false);
        yield return new WaitForSeconds(2);
        
        isPlaying = true;
    }
    /*

    //统计分数
    public void JudgeNote(float noteTime)
    {
        noteTime=System.Math.Abs(noteTime);
        if (noteTime < 0.05f)
            nowScore += 1.2;
        else if (noteTime < 0.1f)
            nowScore += 1;
        else
            nowScore += 0.8;

        double s = (nowScore / totalScore) * 1000000;
        int sco=Convert.ToInt32(s);
        score.text = sco.ToString();
        hits++;
        if (hits > 2)
        {
            hitCount.gameObject.SetActive(true);
        }
        hitCount.text=hits.ToString();
    }
    public void MissNote()
    {
        hits = 0;
        hitCount.gameObject.SetActive(false);
    }

    //点击特效
    public void GenerateEffect(float hitTime,float xPosition)
    {
        if (System.Math.Abs(hitTime) < 0.05f)
        {
            Instantiate(perfect,new Vector3(xPosition,0,0),Quaternion.identity);
        }
        else if(hitTime < 0.1f)
        {
            Instantiate(great,new Vector3(xPosition,-0.1f,0),Quaternion.identity);
        }
        else if (hitTime < -0.1f)
        {
            Instantiate(great, new Vector3(xPosition, 0.1f, 0), Quaternion.identity);
        }
        else if (hitTime < 0.2f)
        {
            Instantiate(normal,new Vector3(xPosition, -0.2f, 0), Quaternion.identity);
        }
        else if (hitTime < -0.2f)
        {
            Instantiate(normal, new Vector3(xPosition, 0.2f, 0), Quaternion.identity);
        }
    }
    */
}
