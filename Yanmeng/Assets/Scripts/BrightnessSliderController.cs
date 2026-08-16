using UnityEngine;
using UnityEngine.UI;

public class BrightnessSliderController : MonoBehaviour
{
    private Slider slider;

    void Start()
    {
        slider = GetComponent<Slider>();

        // 初始化滑动条位置为当前全局亮度
        slider.value = BrightnessManager.Instance.CurrentBrightness;

        // 绑定事件：滑动条调整时更新全局亮度
        slider.onValueChanged.AddListener(OnSliderChanged);

        // 订阅全局亮度变化事件（其他场景调整时更新本场景滑动条）
        BrightnessManager.Instance.OnBrightnessChanged += OnGlobalBrightnessChanged;
    }

    void OnDestroy()
    {
        // 取消订阅事件
        BrightnessManager.Instance.OnBrightnessChanged -= OnGlobalBrightnessChanged;
    }

    private void OnSliderChanged(float value)
    {
        BrightnessManager.Instance.SetBrightness(value);
    }

    private void OnGlobalBrightnessChanged(float brightness)
    {
        // 避免循环触发事件
        if (slider.value != brightness)
        {
            slider.value = brightness;
        }
    }
}