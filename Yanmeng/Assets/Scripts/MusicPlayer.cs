using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class MusicPlayer : MonoBehaviour
{
    [Header("Audio Settings")]
    public AudioSource performanceSource;
    public Slider uiMusicSlider;

    [Header("Other Controls")]
    public Slider bgmSlider;
    public Slider sfxSlider;

    [Header("BGM Settings")]
    public AudioSource bgmSource; // 引用BGM音频源

    [Header("End Panel")]
    public GameObject endPanel; 

    private float originalBGMVolume;
    private float bgmPlaybackPosition; // 存储BGM暂停位置
    private bool bgmWasPlaying; // 记录BGM是否在播放
    private bool hasRestored; // 防止重复恢复

    void Start()
    {
        // 1. 保存并暂停BGM
        SaveAndPauseBGM();

        // 2. 初始化UI音乐音量
        VolumeManager.Instance.SetVolume(VolumeManager.VolumeType.UIMusic, 0.5f);
        uiMusicSlider.value = 0.5f;

        // 3. 加载音乐
        LoadMusic();

        // 4. 保存音量设置
        SaveOriginalVolumes();

        // 5. 设置系统状态
        MuteSystemVolumes();
        ToggleControlInteractivity(false);

        hasRestored = false;
    }

    // 保存并暂停BGM
    void SaveAndPauseBGM()
    {
        if (bgmSource != null)
        {
            // 保存当前播放状态和位置
            bgmWasPlaying = bgmSource.isPlaying;
            bgmPlaybackPosition = bgmSource.time;

            // 暂停BGM
            if (bgmWasPlaying)
            {
                bgmSource.Pause();
            }
        }
    }

    // 恢复BGM播放
    void ResumeBGM()
    {
        if (bgmSource != null && bgmWasPlaying)
        {
            // 设置回原来的位置
            bgmSource.time = bgmPlaybackPosition;

            // 继续播放
            bgmSource.Play();
        }
    }

    void LoadMusic()
    {
        AudioClip clip = Resources.Load<AudioClip>($"music/{SceneLoader.selectedMusic}");
        if (clip == null)
        {
            Debug.LogError($"音乐未找到: {SceneLoader.selectedMusic}");
            return;
        }

        performanceSource.clip = clip;

    }

    void SaveOriginalVolumes()
    {
        originalBGMVolume = VolumeManager.Instance.GetVolume(VolumeManager.VolumeType.BGM);
    }

    void MuteSystemVolumes()
    {
        // 静音BGM，但不要静音SFX
        VolumeManager.Instance.MuteVolume(VolumeManager.VolumeType.BGM, true);
    }

    void ToggleControlInteractivity(bool state)
    {
        // 禁用/启用BGM滑动条
        bgmSlider.interactable = state;

        // UI音乐和音效滑动条始终保持可交互
        uiMusicSlider.interactable = true;
        sfxSlider.interactable = true;
    }

    // 当EndPanel显示时调用此方法
    public void OnEndPanelShown()
    {
        if (hasRestored) return;

        // 恢复BGM播放
        ResumeBGM();

        // 恢复原始BGM音量设置
        VolumeManager.Instance.SetVolume(VolumeManager.VolumeType.BGM, originalBGMVolume);

        // 恢复BGM滑动条交互
        ToggleControlInteractivity(true);

        hasRestored = true;
    }

    // 开始播放演奏音乐
    public void StartPlayback()
    {
        if (performanceSource.clip != null && !performanceSource.isPlaying)
        {
            performanceSource.Play();
        }
    }

    void Update()
    {   
        
        if (!performanceSource.isPlaying) return;

        // 直接控制音频源音量（双重保障）
        performanceSource.volume = uiMusicSlider.value;

        // 同时更新混音器参数
        VolumeManager.Instance.SetVolume(
            VolumeManager.VolumeType.UIMusic,
            uiMusicSlider.value
        );

        // 检测EndPanel状态并在需要时调用恢复方法
        if (endPanel != null && endPanel.activeInHierarchy && !hasRestored)
        {
            OnEndPanelShown();
        }
    }
}
// MusicPlayer.cs 完整修正版
/*using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class MusicPlayer : MonoBehaviour
{
    [Header("Audio Settings")]
    public AudioSource performanceSource;
    public Slider uiMusicSlider;

    [Header("Other Controls")]
    public Slider bgmSlider;
    public Slider sfxSlider;

    private float originalBGMVolume;
    private float originalSFXVolume;
    private float originalUIMusicVolume;

    void Start()
    {
        // 初始化UI音乐音量（必须步骤）
        VolumeManager.Instance.SetVolume(VolumeManager.VolumeType.UIMusic, 0.5f);
        uiMusicSlider.value = 0.5f;

        // 加载音乐
        LoadMusic();

        // 保存并设置系统状态
        SaveOriginalVolumes();
        MuteSystemVolumes();
        ToggleControlInteractivity(false);

        StartCoroutine(MonitorPlayback());
    }

    void LoadMusic()
    {
        AudioClip clip = Resources.Load<AudioClip>($"music/{SceneLoader.selectedMusic}");
        if (clip == null)
        {
            Debug.LogError($"音乐未找到: {SceneLoader.selectedMusic}");
            return;
        }

        performanceSource.clip = clip;
        // 移除了 performanceSource.Play() 调用
    }

    void SaveOriginalVolumes()
    {
        originalBGMVolume = VolumeManager.Instance.GetVolume(VolumeManager.VolumeType.BGM);
        originalSFXVolume = VolumeManager.Instance.GetVolume(VolumeManager.VolumeType.SFX);
        originalUIMusicVolume = VolumeManager.Instance.GetVolume(VolumeManager.VolumeType.UIMusic);
    }

    void MuteSystemVolumes()
    {
        VolumeManager.Instance.MuteVolume(VolumeManager.VolumeType.BGM, true);
        VolumeManager.Instance.MuteVolume(VolumeManager.VolumeType.SFX, true);
        VolumeManager.Instance.MuteVolume(VolumeManager.VolumeType.UIMusic, false);
    }

    void ToggleControlInteractivity(bool state)
    {
        bgmSlider.interactable = state;
        sfxSlider.interactable = state;
        uiMusicSlider.interactable = true; // 始终保持可交互
    }

    IEnumerator MonitorPlayback()
    {
        yield return new WaitWhile(() => performanceSource.isPlaying);

        // 恢复原始设置
        VolumeManager.Instance.SetVolume(VolumeManager.VolumeType.BGM, originalBGMVolume);
        VolumeManager.Instance.SetVolume(VolumeManager.VolumeType.SFX, originalSFXVolume);
        VolumeManager.Instance.SetVolume(VolumeManager.VolumeType.UIMusic, originalUIMusicVolume);
        ToggleControlInteractivity(true);
    }

    void Update()
    {

        if (!performanceSource.isPlaying) return;

        // 直接控制音频源音量（双重保障）
        performanceSource.volume = uiMusicSlider.value;

        // 同时更新混音器参数
        VolumeManager.Instance.SetVolume(
            VolumeManager.VolumeType.UIMusic,
            uiMusicSlider.value
        );
    }
}*/