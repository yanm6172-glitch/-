using UnityEngine;
using UnityEngine.UI;

public class VolumeSlider : MonoBehaviour
{
    public VolumeManager.VolumeType volumeType; // 在Inspector中指定类型（BGM/UIMusic/SFX）
    private Slider slider;

    void Start()
    {
        slider = GetComponent<Slider>();

        // 初始化滑动条位置
        slider.value = VolumeManager.Instance.GetVolume(volumeType);

        // 绑定事件：滑动条拖动时修改音量
        slider.onValueChanged.AddListener(value =>
        {
            VolumeManager.Instance.SetVolume(volumeType, value);
        });

        // 订阅全局音量变化事件
        VolumeManager.OnVolumeChanged += OnGlobalVolumeChanged;
    }

    void OnDestroy()
    {
        // 取消订阅事件
        VolumeManager.OnVolumeChanged -= OnGlobalVolumeChanged;
    }

    // 当其他场景或UI修改音量时，更新当前滑动条
    private void OnGlobalVolumeChanged(VolumeManager.VolumeType type, float volume)
    {
        if (type == volumeType)
        {
            slider.value = volume;
        }
    }
}
