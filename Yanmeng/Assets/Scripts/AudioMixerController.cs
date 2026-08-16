using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.UI;

public class AudioMixerController : MonoBehaviour
{
    public AudioMixer masterMixer; // 拖入创建的AudioMixer
    public Slider bgmSlider;
    public Slider uiMusicSlider;
    public Slider sfxSlider;

    void Start()
    {
        // 初始化滑动条位置（加载保存的值）
        bgmSlider.value = PlayerPrefs.GetFloat("BGMVolume", 0.5f);
        uiMusicSlider.value = PlayerPrefs.GetFloat("UIMusicVolume", 0.5f);
        sfxSlider.value = PlayerPrefs.GetFloat("SFXVolume", 0.5f);

        // 设置初始音量
        SetBGMVolume(bgmSlider.value);
        SetUIMusicVolume(uiMusicSlider.value);
        SetSFXVolume(sfxSlider.value);
    }

    // BGM音量控制
    public void SetBGMVolume(float volume)
    {
        masterMixer.SetFloat("BGMVolume", Mathf.Log10(volume) * 20);
        PlayerPrefs.SetFloat("BGMVolume", volume);
    }

    // 界面音乐音量控制
    public void SetUIMusicVolume(float volume)
    {
        masterMixer.SetFloat("UIMusicVolume", Mathf.Log10(volume) * 20);
        PlayerPrefs.SetFloat("UIMusicVolume", volume);
    }

    // 音效音量控制
    public void SetSFXVolume(float volume)
    {
        masterMixer.SetFloat("SFXVolume", Mathf.Log10(volume) * 20);
        PlayerPrefs.SetFloat("SFXVolume", volume);
    }
}
