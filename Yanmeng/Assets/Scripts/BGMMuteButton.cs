using UnityEngine;
using UnityEngine.UI;

public class BGMMuteButton : MonoBehaviour
{
    public Sprite mutedSprite;
    public Sprite unmutedSprite;
    public Image buttonImage;

    private void OnEnable()
    {
        VolumeManager.OnMuteStateChanged += UpdateButtonState;
        UpdateButtonState(VolumeManager.VolumeType.BGM, VolumeManager.Instance.IsMuted(VolumeManager.VolumeType.BGM));
    }

    private void OnDisable()
    {
        VolumeManager.OnMuteStateChanged -= UpdateButtonState;
    }

    private void UpdateButtonState(VolumeManager.VolumeType type, bool isMuted)
    {
        if (type == VolumeManager.VolumeType.BGM)
            buttonImage.sprite = isMuted ? mutedSprite : unmutedSprite;
    }

    public void ToggleMute()
    {
        bool currentState = VolumeManager.Instance.IsMuted(VolumeManager.VolumeType.BGM);
        VolumeManager.Instance.MuteVolume(VolumeManager.VolumeType.BGM, !currentState);
    }
}