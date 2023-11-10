package works.bread.barztwiliovideo

/**

Component for patching black screen bug coming from Twilio VideoView
Authors:
Aaron Alaniz (@aaalaniz) aaron.a.alaniz@gmail.com
 */

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import com.twilio.video.VideoView
import tvi.webrtc.VideoFrame

/*

VideoView that notifies Listener of the first frame rendered and the first frame after a reset

request.
*/
class PatchedVideoView : VideoView {

    private var notifyFrameRendered = false
    private var listener: Listener? = null
    private val mainThreadHandler = Handler(Looper.getMainLooper())

    constructor(context: Context) : super(context)
    constructor(context: Context, attrs: AttributeSet) : super(context, attrs)

    override fun onFrame(frame: VideoFrame?) {
        if (notifyFrameRendered) {
            notifyFrameRendered = false
            mainThreadHandler.post {
                listener?.onFirstFrame()
            }
        }
        super.onFrame(frame)
    }

    /*

    Set your listener
    */
    fun setListener(listener: Listener) {
        this.listener = listener
    }
    /*

    Reset the listener so next frame rendered results in callback
    */
    fun resetListener() {
        notifyFrameRendered = true
    }
    interface Listener {
        fun onFirstFrame()
    }
}