// SceneLoader.cs
using UnityEngine;
using UnityEngine.SceneManagement;

public class SceneLoader : MonoBehaviour
{
    public static string nextSceneName;
    public static string selectedInstrument;
    public static string selectedMusic;

    public static void LoadScene(string sceneName)
    {
        nextSceneName = sceneName;
        SceneManager.LoadScene("Load");
    }

    public static void ReloadCurrentScene()
    {
        LoadScene(SceneManager.GetActiveScene().name);
    }
}