package com.doomscrolldetox;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;

public class AntiscrollPopupActivity extends Activity {

    public static final String EXTRA_PACKAGE = "extra_package";
    public static final String EXTRA_WARNING_SECONDS = "extra_warning_seconds";

    private String targetPackage;
    private int warningSeconds;
    private CountDownTimer timer;
    private Button btnClose;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);

        targetPackage = getIntent().getStringExtra(EXTRA_PACKAGE);
        warningSeconds = getIntent().getIntExtra(EXTRA_WARNING_SECONDS, 10);
        if (targetPackage == null) {
            finish();
            return;
        }

        int dp = (int) (getResources().getDisplayMetrics().density);

        // Main layout
        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setGravity(Gravity.CENTER);
        mainLayout.setPadding(24 * dp, 24 * dp, 24 * dp, 24 * dp);
        mainLayout.setBackgroundColor(Color.parseColor("#1a1c29"));

        // Title
        TextView tvTitle = new TextView(this);
        tvTitle.setText("Scrolling limit reached");
        tvTitle.setTextColor(Color.WHITE);
        tvTitle.setTextSize(26);
        tvTitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.bottomMargin = 16 * dp;
        mainLayout.addView(tvTitle, titleParams);

        // Subtitle
        TextView tvSubtitle = new TextView(this);
        tvSubtitle.setText("You have " + warningSeconds + " seconds to wrap up after closing this popup. If you keep scrolling afterwards, the app will be completely blocked.");
        tvSubtitle.setTextColor(Color.parseColor("#a0a4b8"));
        tvSubtitle.setTextSize(16);
        tvSubtitle.setGravity(Gravity.CENTER);
        tvSubtitle.setLineSpacing(4 * dp, 1.0f);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.bottomMargin = 32 * dp;
        mainLayout.addView(tvSubtitle, subtitleParams);

        // Timer
        TextView tvTimer = new TextView(this);
        tvTimer.setText(String.valueOf(warningSeconds));
        tvTimer.setTextColor(Color.parseColor("#69c9d0"));
        tvTimer.setTextSize(48);
        tvTimer.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams timerParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        timerParams.bottomMargin = 32 * dp;
        mainLayout.addView(tvTimer, timerParams);

        // Button
        btnClose = new Button(this);
        btnClose.setText("Wait...");
        btnClose.setTextColor(Color.WHITE);
        btnClose.setTextSize(16);
        btnClose.setEnabled(false);
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(Color.parseColor("#2d3142"));
        btnBg.setCornerRadius(12 * dp);
        btnClose.setBackground(btnBg);
        
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 56 * dp);
        mainLayout.addView(btnClose, btnParams);

        setContentView(mainLayout);

        // Logic
        btnClose.setText("Wait (" + warningSeconds + "s)");

        timer = new CountDownTimer(warningSeconds * 1000L, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                int sec = (int) (millisUntilFinished / 1000);
                btnClose.setText("Wait (" + sec + "s)");
                tvTimer.setText(String.valueOf(sec));
            }

            @Override
            public void onFinish() {
                btnClose.setEnabled(true);
                btnClose.setText("I Understand");
                tvTimer.setVisibility(View.GONE);
                
                GradientDrawable activeBg = new GradientDrawable();
                activeBg.setColor(Color.parseColor("#e1306c")); // Accent
                activeBg.setCornerRadius(12 * dp);
                btnClose.setBackground(activeBg);
            }
        }.start();

        btnClose.setOnClickListener(v -> {
            startGracePeriodAndFinish();
        });
    }

    private void startGracePeriodAndFinish() {
        SharedPreferences prefs = getSharedPreferences("DoomscrollDetoxPrefs", Context.MODE_PRIVATE);
        long graceEnd = System.currentTimeMillis() + 10_000L;
        prefs.edit().putLong("antiscroll_grace_end_" + targetPackage, graceEnd).apply();
        finish();
    }

    @Override
    public void onBackPressed() {
        if (btnClose.isEnabled()) {
            startGracePeriodAndFinish();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (timer != null) timer.cancel();
    }
}
