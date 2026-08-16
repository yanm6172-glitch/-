using System.Collections;
// LoadingController.cs
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;

public class LoadingController : MonoBehaviour
{
    [SerializeField] private Slider progressSlider;
    [SerializeField] private TextMeshProUGUI progressText;

    private void Start()
    {
        StartCoroutine(LoadTargetScene());
    }

    private IEnumerator LoadTargetScene()
    {
        if (string.IsNullOrEmpty(SceneLoader.nextSceneName))
        {
            Debug.LogError("No target scene specified!");
            yield break;
        }

        int displayProgress = 0;
        AsyncOperation op = SceneManager.LoadSceneAsync(SceneLoader.nextSceneName);
        op.allowSceneActivation = false;

        while (op.progress < 0.9f)
        {
            float realProgress = Mathf.Clamp01(op.progress / 0.9f);
            UpdateProgressDisplay(Mathf.RoundToInt(realProgress * 100));
            yield return null;
        }

        while (displayProgress < 100)
        {
            displayProgress++;
            UpdateProgressDisplay(displayProgress);
            yield return new WaitForEndOfFrame();
        }

        op.allowSceneActivation = true;
    }

    private void UpdateProgressDisplay(int progress)
    {
        if (progressSlider) progressSlider.value = progress;
        if (progressText) progressText.text = $"{progress}%";
    }
}