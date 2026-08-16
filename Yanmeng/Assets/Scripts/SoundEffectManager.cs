using UnityEngine;
using UnityEngine.Audio;

public class SoundEffectManager : MonoBehaviour
{
    public static SoundEffectManager Instance { get; private set; }

    // 绑定到SFX总线
    [SerializeField] private AudioMixerGroup sfxMixerGroup;
    private AudioSource audioSource;

    private void Awake()
    {
        // 单例初始化
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        // 创建AudioSource并配置
        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.outputAudioMixerGroup = sfxMixerGroup;
        audioSource.playOnAwake = false;
    }

    // 播放音效（静态方法方便调用）
    public static void PlaySFX(AudioClip clip)
    {
        if (Instance != null && clip != null)
        {
            Instance.audioSource.PlayOneShot(clip);
        }
    }
}
