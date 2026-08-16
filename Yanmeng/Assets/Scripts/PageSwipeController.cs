// PageSwipeController.cs
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using DG.Tweening;
using System.Collections;
using Unity.VisualScripting;

public class PageSwipeController : MonoBehaviour
{
    public ScrollRect scrollRect;
    public RectTransform content;
    public int pageCount;
    public float swipeThreshold = 50f;
    public float animationDuration = 0.3f;

    [Header("Instrument Selection")]
    public Button[] highlightButtons;
    public string[] targetSceneNames;

    private float[] pagePositions;
    private int currentPage = 0;

    void Start()
    {
        scrollRect.inertia = false;
        InitializePagePositions();
        scrollRect.onValueChanged.AddListener(HandleScroll); // 修改此处
        InitializeButtons();
    }

    // 修改方法名称和实现
    void HandleScroll(Vector2 position)
    {
        // 可保留空实现或添加滚动处理逻辑
    }

    void InitializePagePositions()
    {
        if (pageCount <= 0) return;

        pagePositions = new float[pageCount];
        float step = 1f / (pageCount - 1);
        for (int i = 0; i < pageCount; i++)
        {
            pagePositions[i] = i * step;
        }
    }

    void InitializeButtons()
    {
        for (int i = 0; i < highlightButtons.Length; i++)
        {
            highlightButtons[i].interactable = false;
            int pageIndex = i;
            highlightButtons[i].onClick.AddListener(() => OnInstrumentClick(pageIndex));
        }
        UpdateButtonState();
    }

    public void OnDragEnd(BaseEventData eventData)
    {
        PointerEventData pointerData = (PointerEventData)eventData;
        float deltaX = pointerData.delta.x;
        if (Mathf.Abs(deltaX) < swipeThreshold)
        {
            ScrollToPage(currentPage);
            return;
        }

        if (deltaX > 0) SwitchToPreviousPage();
        else SwitchToNextPage();
    }

    public void SwitchToNextPage()
    {
        currentPage = Mathf.Min(currentPage + 1, pageCount - 1);
        ScrollToPage(currentPage);
    }

    public void SwitchToPreviousPage()
    {
        currentPage = Mathf.Max(currentPage - 1, 0);
        ScrollToPage(currentPage);
    }

    public void ScrollToPage(int pageIndex)
    {
        if (pageIndex < 0 || pageIndex >= pageCount) return;

        float targetPosition = pagePositions[pageIndex];
        DOTween.To(
            () => scrollRect.horizontalNormalizedPosition,
            x => scrollRect.horizontalNormalizedPosition = x,
            targetPosition,
            animationDuration
        ).SetEase(Ease.OutQuad).OnComplete(UpdateButtonState);
    }

    private void UpdateButtonState()
    {
        for (int i = 0; i < highlightButtons.Length; i++)
        {
            highlightButtons[i].interactable = (i == currentPage);
        }
    }

    private void OnInstrumentClick(int pageIndex)
    {
        SceneLoader.selectedInstrument = targetSceneNames[pageIndex];
        SceneLoader.LoadScene("ChooseMusic");
    }
}