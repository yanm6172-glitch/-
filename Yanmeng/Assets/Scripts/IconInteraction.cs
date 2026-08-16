// IconInteraction.cs
using UnityEngine;
using UnityEngine.EventSystems;
using System.Collections;

public class IconInteraction : MonoBehaviour,
    IPointerEnterHandler,
    IPointerExitHandler,
    IPointerClickHandler
{
    [Header("Visual Settings")]
    public GameObject[] highlightImages;
    public float sceneTransitionDelay = 0.5f;

    [Header("Music Settings")]
    public string musicName;

    private void Start()
    {
        ToggleHighlight(false);
    }

    public void OnPointerEnter(PointerEventData eventData)
    {
        ToggleHighlight(true);
    }

    public void OnPointerExit(PointerEventData eventData)
    {
        ToggleHighlight(false);
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        StartCoroutine(HandleSceneTransition());
    }

    private IEnumerator HandleSceneTransition()
    {
        SceneLoader.selectedMusic = musicName;
        yield return new WaitForSeconds(sceneTransitionDelay);
        SceneLoader.LoadScene(SceneLoader.selectedInstrument);
    }

    private void ToggleHighlight(bool state)
    {
        foreach (var img in highlightImages)
        {
            if (img != null)
                img.SetActive(state);
        }
    }
}