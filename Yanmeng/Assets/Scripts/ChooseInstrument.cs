using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class ChooseInstrument : MonoBehaviour
{
    [Header("Instrument Selection")]
    public Button[] highlightButtons;
    public string[] targetSceneNames;

    void Start()
    {
        InitializeButtons();
    }

    void InitializeButtons()
    {
        // 确保按钮和场景数量匹配
        if (highlightButtons.Length != targetSceneNames.Length)
        {
            Debug.LogError("按钮数量与场景名称数量不匹配！");
            return;
        }

        // 为每个按钮添加点击事件
        for (int i = 0; i < highlightButtons.Length; i++)
        {
            int index = i; // 创建局部变量避免闭包问题
            highlightButtons[i].onClick.AddListener(() => OnInstrumentClick(index));
        }
    }

    private void OnInstrumentClick(int buttonIndex)
    {
        // 存储选中的乐器场景名称
        SceneLoader.selectedInstrument = targetSceneNames[buttonIndex];

        // 跳转到选择音乐场景
        SceneLoader.LoadScene("ChooseMusic");
    }
}
