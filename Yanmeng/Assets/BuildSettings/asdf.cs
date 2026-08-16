using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class asdf : MonoBehaviour
{
    [Header("技能冷却时长")]
    public float coldTime = 5f; // 修复：赋予默认冷却时间，公开可在Inspector修改
    private bool isCooling = false; // 重命名语义更清晰
    private float coolTimer = 0f;
    private Image fillImage; // 规范小驼峰命名

    void Start()
    {
        // 安全获取组件，增加空值保护
        Transform fillObj = transform.Find("Fill");
        if (fillObj != null)
        {
            fillImage = fillObj.GetComponent<Image>();
            fillImage.fillAmount = 1f; // 初始状态冷却完成，填充满
        }
    }

    void Update()
    {
        // 按键触发冷却，仅在不在冷却时生效
        if (Input.GetKeyDown(KeyCode.Alpha1) && !isCooling)
        {
            StartCoolDown();
        }

        if (isCooling)
        {
            coolTimer += Time.deltaTime;
            // 常规UI逻辑：冷却从0填充到1
            fillImage.fillAmount = coolTimer / coldTime;

            // 冷却完成重置
            if (coolTimer >= coldTime)
            {
                coolTimer = 0f;
                fillImage.fillAmount = 1f;
                isCooling = false;
            }
        }
    }

    // 按钮点击调用入口
    public void ButtonControl()
    {
        if (!isCooling)
        {
            StartCoolDown();
        }
    }

    // 统一开启冷却方法，复用逻辑
    private void StartCoolDown()
    {
        isCooling = true;
        coolTimer = 0f;
        fillImage.fillAmount = 0f;
    }
}
