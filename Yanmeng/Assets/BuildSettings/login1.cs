using System.Collections;
using System.Collections.Generic;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using UnityEngine;

public class login1 : MonoBehaviour
{
    public InputField UsermaneInput;
    public InputField PasswordInput;
    public void OnButtonClick()
    {
        string usermane = UsermaneInput.text;
        string password = PasswordInput.text;
        if (password == "2423830" && usermane == "yanmeng")
        {
            SceneManager.LoadScene("Home");
        }
   

    }

}
