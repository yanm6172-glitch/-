using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using System.Collections;

[RequireComponent(typeof(Image), typeof(Button))] // 同时要求Button组件
public class UIHoverEffect : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
{
    [Header("缩放设置")]
    [Tooltip("悬停时的缩放倍数")]
    public float hoverScale = 1.2f;
    [Tooltip("缩放过渡速度")]
    [Range(0.1f, 10f)] public float scaleSpeed = 5f;

    [Header("颜色设置")]
    [Tooltip("悬停高亮颜色")]
    public Color hoverColor = new Color(1.2f, 1.2f, 1.2f, 1f);
    [Tooltip("颜色过渡速度")]
    [Range(0.1f, 10f)] public float colorSpeed = 5f;

    [Header("额外图片设置")]
    [Tooltip("需要显示的额外图片")]
    public GameObject popupImage; // 需要显示/隐藏的图片对象
    [Tooltip("出现/消失速度")]
    [Range(0.1f, 10f)] public float appearSpeed = 5f;

    [Header("场景跳转设置")]
    [Tooltip("目标场景名称（需添加到Build Settings）")]
    public string targetSceneName ;

    private Image _targetImage;
    private RectTransform _rectTransform;

    private Vector3 _originalScale;
    private Color _originalColor;

    private Vector3 _targetScale;
    private Color _targetColor;

    private CanvasGroup _popupCanvasGroup;

    private Button _button;

    private bool _isLoading; //防止重复点击

    private bool _isHovering;

    void Start()
    {
        // 获取组件引用
        _targetImage = GetComponent<Image>();
        _rectTransform = GetComponent<RectTransform>();
        _button = GetComponent<Button>();

        // 存储原始状态
        _originalScale = _rectTransform.localScale;
        _originalColor = _targetImage.color;

        // 初始化目标值
        _targetScale = _originalScale;
        _targetColor = _originalColor;

        // 初始化额外图片
        if (popupImage != null)
        {
            // 添加CanvasGroup用于透明过渡
            _popupCanvasGroup = popupImage.GetComponent<CanvasGroup>();
            if (_popupCanvasGroup == null)
            {
                _popupCanvasGroup = popupImage.AddComponent<CanvasGroup>();
            }

            // 初始状态：完全透明且激活状态
            _popupCanvasGroup.alpha = 0;
            popupImage.SetActive(false);
        }

        // 安全获取Button组件
        if (!TryGetComponent(out _button))
        {
            Debug.LogError("未找到Button组件", this);
            enabled = false;
            return;
        }

        // 绑定点击事件
        _button.onClick.AddListener(OnClick);
    }

    void Update()
    {
        // 平滑缩放过渡
        _rectTransform.localScale = Vector3.Lerp(
            _rectTransform.localScale,
            _targetScale,
            Time.deltaTime * scaleSpeed
        );

        // 平滑颜色过渡
        _targetImage.color = Color.Lerp(
            _targetImage.color,
            _targetColor,
            Time.deltaTime * colorSpeed
        );

        // 控制额外图片的透明度
        if (popupImage != null)
        {
            if (_isHovering)
            {
                // 激活对象并逐渐显示
                if (!popupImage.activeSelf) popupImage.SetActive(true);

                _popupCanvasGroup.alpha = Mathf.Lerp(
                    _popupCanvasGroup.alpha,
                    1f,
                    Time.deltaTime * appearSpeed
                );
            }
            else
            {
                // 逐渐隐藏后禁用对象
                _popupCanvasGroup.alpha = Mathf.Lerp(
                    _popupCanvasGroup.alpha,
                    0f,
                    Time.deltaTime * appearSpeed
                );

                if (_popupCanvasGroup.alpha < 0.01f)
                {
                    popupImage.SetActive(false);
                }
            }
        }
    }

    //异步加载场景
    private AsyncOperation _asyncOperation;

    private IEnumerator LoadSceneAsync()
    {
        _isLoading = true;
        _button.interactable = false; //禁用交互

        _asyncOperation = SceneManager.LoadSceneAsync(targetSceneName);
        _asyncOperation.allowSceneActivation = false;

        while (!_asyncOperation.isDone)
        {
            if (_asyncOperation.progress >= 0.9f)
            {
                // 显示"点击继续"提示
                if (Input.GetMouseButtonDown(0))
                    _asyncOperation.allowSceneActivation = true;
            }
            yield return null;
        }
    }

    // 点击事件处理，OnClick方法
    private void OnClick()
    {
        // 重置悬停状态
        ResetState();

        StartCoroutine(LoadSceneAsync());
    }

    // 修改悬停触发条件：仅在按钮可交互时响应
    public void OnPointerEnter(PointerEventData eventData)
    {
        if (!_button.interactable) return;

        _isHovering = true;
        _targetScale = _originalScale * hoverScale;
        _targetColor = hoverColor;
    }

    // 新增重置方法（公开给外部调用）
    public void ResetState()
    {
        _isHovering = false;
        _rectTransform.localScale = _originalScale;
        _targetImage.color = _originalColor;
        _targetScale = _originalScale;
        _targetColor = _originalColor;

        if (popupImage != null)
        {
            _popupCanvasGroup.alpha = 0;
            popupImage.SetActive(false);
        }
    }

    /*public void OnPointerEnter(PointerEventData eventData)
    {
        _isHovering = true;
        _targetScale = _originalScale * hoverScale;
        _targetColor = hoverColor;
    }*/

    public void OnPointerExit(PointerEventData eventData)
    {
        _isHovering = false;
        _targetScale = _originalScale;
        _targetColor = _originalColor;
    }

    // 当组件被禁用时重置状态
    void OnDisable()
    {
        StopAllCoroutines(); //停止协程

        if (_isHovering)
        {
            _rectTransform.localScale = _originalScale;
            _targetImage.color = _originalColor;
            _targetScale = _originalScale;
            _targetColor = _originalColor;
            _isHovering = false;
        }
    }
}