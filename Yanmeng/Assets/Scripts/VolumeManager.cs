using UnityEngine;
using UnityEngine.Audio;
using System;
using System.Collections.Generic;

public class VolumeManager : MonoBehaviour
{
    public static VolumeManager Instance { get; private set; }

    [Header("Audio Mixer")]
    public AudioMixer masterMixer;

    public enum VolumeType { BGM, UIMusic, SFX }
    public static event Action<VolumeType, float> OnVolumeChanged;
    public static event Action<VolumeType, bool> OnMuteStateChanged;

    private Dictionary<VolumeType, bool> isMuted = new Dictionary<VolumeType, bool>();
    private Dictionary<VolumeType, float> preMuteVolume = new Dictionary<VolumeType, float>();

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        foreach (VolumeType type in Enum.GetValues(typeof(VolumeType)))
        {
            isMuted[type] = false;
            preMuteVolume[type] = 0.5f;
        }

        SetVolume(VolumeType.BGM, 0.5f);
        SetVolume(VolumeType.UIMusic, 0.5f);
        SetVolume(VolumeType.SFX, 0.9f);

        // 确保UIMusic初始音量正确
        if (!PlayerPrefs.HasKey("UIMusicVolume"))
        {
            SetVolume(VolumeType.UIMusic, 0.5f); // 设置默认值
        }
    }

    public void SetVolume(VolumeType type, float volume)
    {
        if (isMuted[type])
        {
            isMuted[type] = false;
            OnMuteStateChanged?.Invoke(type, false);
        }

        // 新增调试输出
        Debug.Log($"设置音量 {type} => {volume}");

        string paramName = type.ToString() + "Volume";
        float dB = volume > 0.0001f ? Mathf.Log10(volume) * 20 : -80f;

        // 验证参数存在性
        if (!masterMixer.SetFloat(paramName, dB))
        {
            Debug.LogError($"找不到音频参数: {paramName}");
        }

        masterMixer.SetFloat(paramName, dB);
        PlayerPrefs.SetFloat(paramName, volume);
        PlayerPrefs.Save();

        OnVolumeChanged?.Invoke(type, volume);
    }

    public float GetVolume(VolumeType type)
    {
        string paramName = type.ToString() + "Volume";
        return PlayerPrefs.GetFloat(paramName, 0.5f);
    }

    public void MuteVolume(VolumeType type, bool mute)
    {
        if (isMuted[type] == mute) return;

        if (mute)
        {
            preMuteVolume[type] = GetVolume(type);
            masterMixer.SetFloat(type.ToString() + "Volume", -80f);
        }
        else
        {
            float dB = preMuteVolume[type] > 0.0001f ?
                Mathf.Log10(preMuteVolume[type]) * 20 : -80f;
            masterMixer.SetFloat(type.ToString() + "Volume", dB);
        }

        isMuted[type] = mute;
        OnMuteStateChanged?.Invoke(type, mute);
    }

    public bool IsMuted(VolumeType type) => isMuted[type];
}