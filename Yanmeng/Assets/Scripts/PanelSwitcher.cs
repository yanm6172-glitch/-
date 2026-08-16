using UnityEngine;

public class PanelSwitcher : MonoBehaviour
{
    [Header("界面配置")]
    [SerializeField] private GameObject panelToShow; // 需要显示的界面
    [SerializeField] private GameObject panelToHide; // 需要关闭的界面

    // 通过按钮触发的方法
    public void SwitchPanels()
    {
        if (panelToShow != null) panelToShow.SetActive(true);
        if (panelToHide != null) panelToHide.SetActive(false);
    }

    // 扩展方法：可同时处理多个关闭的面板
    public void SwitchPanels(GameObject[] panelsToHide)
    {
        if (panelToShow != null) panelToShow.SetActive(true);
        foreach (var panel in panelsToHide)
        {
            if (panel != null) panel.SetActive(false);
        }
    }
}
