using UnityEngine;

public class PanelController : MonoBehaviour
{
    [Header("UI References")]
    [SerializeField] private GameObject popupPanel;

    void Start()
    {
        // 确保面板初始为关闭状态
        if (popupPanel != null)
            popupPanel.SetActive(false);
    }

    public void TogglePanel()
    {
        if (popupPanel == null) return;

        bool shouldActivate = !popupPanel.activeSelf;
        popupPanel.SetActive(shouldActivate);

        // 可选：当面板打开时暂停游戏
        Time.timeScale = shouldActivate ? 0 : 1;
    }
}
