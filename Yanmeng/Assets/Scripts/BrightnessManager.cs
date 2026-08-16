using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

public class BrightnessManager : MonoBehaviour
{
    public static BrightnessManager Instance { get; private set; }

    [Header("遮罩组件")]
    public Image brightnessOverlay;

    // 当前亮度值（0~1）
    public float CurrentBrightness { get; private set; } = 1f;

    // 亮度变化事件
    public event System.Action<float> OnBrightnessChanged;

    private void Awake()
    {
        // 单例模式防重复
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        // 首次启动强制设为1，后续场景切换保留当前值
        if (!PlayerPrefs.HasKey("GlobalBrightness"))
        {
            ForceResetToMaxBrightness();
        }
        else
        {
            CurrentBrightness = PlayerPrefs.GetFloat("GlobalBrightness");
            UpdateOverlayAlpha(CurrentBrightness);
        }
    }

    // 强制重置亮度为1（用于游戏启动）
    public void ForceResetToMaxBrightness()
    {
        SetBrightness(1f);
        PlayerPrefs.SetFloat("GlobalBrightness", 1f);
        PlayerPrefs.Save();
    }

    // 设置亮度并触发事件
    public void SetBrightness(float brightness)
    {
        CurrentBrightness = Mathf.Clamp01(brightness);
        UpdateOverlayAlpha(CurrentBrightness);
        PlayerPrefs.SetFloat("GlobalBrightness", CurrentBrightness);
        PlayerPrefs.Save();

        // 通知所有监听者亮度已变化
        OnBrightnessChanged?.Invoke(CurrentBrightness);
    }

    private void UpdateOverlayAlpha(float brightness)
    {
        if (brightnessOverlay != null)
        {
            float alpha = 1 - brightness;
            brightnessOverlay.color = new Color(0, 0, 0, alpha);
        }
    }

    private void OnEnable()
    {
        SceneManager.sceneLoaded += OnSceneLoaded;
    }

    private void OnDisable()
    {
        SceneManager.sceneLoaded -= OnSceneLoaded;
    }

    private void OnSceneLoaded(Scene scene, LoadSceneMode mode)
    {
        // 新场景加载时重新绑定遮罩组件
        brightnessOverlay = FindObjectOfType<BrightnessOverlayTag>()?.GetComponent<Image>();
        UpdateOverlayAlpha(CurrentBrightness);
    }
}