const crypto = require("node:crypto");

const TOKEN_TTL_MS = 30 * 60 * 1000;

function createTransporter() {
  const nodemailer = require("nodemailer");
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
}

function createVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return {
    rawToken,
    hash: crypto.createHash("sha256").update(rawToken).digest("hex"),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  };
}

async function deliverVerificationEmail(user, rawToken) {
  const origin = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const url = `${origin}/verify-email?token=${encodeURIComponent(rawToken)}`;

  if (process.env.EMAIL_ENABLED !== "true") {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Development verification URL:\n${url}`);
    }
    return;
  }

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "Verify your Job Portal email",
    text: `Hello ${user.name},\n\nPlease verify your email by opening this link:\n${url}\n\nThis link expires in 30 minutes. If you did not create this account, you can ignore this message.`,
    html: `<p>Hello ${escapeHtml(user.name)},</p><p>Please verify your email address to finish setting up your Job Portal account.</p><p><a href="${url}">Verify your email</a></p><p>This link expires in 30 minutes. If you did not create this account, you can ignore this message.</p>`,
  });
}

async function sendApplicationSubmittedEmail(recruiter, applicantName, jobTitle) {
  if (process.env.EMAIL_ENABLED !== "true") return;
  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: recruiter.email,
    subject: `New application for ${jobTitle}`,
    text: `${applicantName} has applied for your ${jobTitle} position.`,
    html: `<p>${escapeHtml(applicantName)} has applied for your <strong>${escapeHtml(jobTitle)}</strong> position.</p>`,
  });
}

async function sendApplicationStatusEmail(applicant, jobTitle, status) {
  if (process.env.EMAIL_ENABLED !== "true") return;
  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: applicant.email,
    subject: `Application update: ${jobTitle}`,
    text: `Your application for ${jobTitle} is now ${status}.`,
    html: `<p>Your application for <strong>${escapeHtml(jobTitle)}</strong> is now ${escapeHtml(status)}.</p>`,
  });
}

async function sendRecruitmentUpdateEmail(applicant, job, round, event) {
  if (process.env.EMAIL_ENABLED !== "true") return;
  const zonedDate = round.scheduledAt ? new Date(round.scheduledAt).toLocaleString("en-IN", { timeZone: process.env.APP_TIME_ZONE || "Asia/Kolkata", dateStyle: "long", timeStyle: "short" }) : "";
  const actionLabel = /assessment|test|assignment/i.test(round.type) ? "Start" : "Join";
  const subject = `${round.title} ${event} - ${job.title}`;
  const nextSteps = event === "Shortlisted" ? `Next steps: ${round.instructions || "Please check WorkPath for the round details and any updates from the recruitment team."}` : "";
  const details = [zonedDate && `Date and time: ${zonedDate}`, round.duration && `Duration: ${round.duration} minutes`, round.mode && `Mode: ${round.mode === "ONLINE" ? "Online" : "In person"}`, round.platform && `Platform: ${round.platform}`, round.meetingLink && `Link: ${round.meetingLink}`, round.location && `Location: ${round.location}`, round.interviewer && `Interviewer: ${round.interviewer}`, round.description && `Description: ${round.description}`, round.instructions && `Instructions: ${round.instructions}`, nextSteps].filter(Boolean).join("\n");
  const linkHtml = round.meetingLink && event !== "Cancelled" ? `<p><a href="${escapeHtml(round.meetingLink)}">${actionLabel} ${escapeHtml(round.title)}</a></p>` : "";
  const introduction = event === "Shortlisted"
    ? `Congratulations! You have been shortlisted for the ${round.title} stage of the ${job.title} recruitment process${round.previousRoundTitle ? ` after completing ${round.previousRoundTitle}` : ""}. ${zonedDate ? "Your round is scheduled; the details are below." : "Your interview schedule will be shared through WorkPath once it is scheduled."}`
    : event === "Not shortlisted"
      ? `You were not shortlisted for the next round after ${round.previousRoundTitle || round.title} for ${job.title}. The recruitment process has ended for this application.`
      : event === "Scheduled"
        ? `Your ${round.title} for ${job.title} has been scheduled. The details are below.`
        : `${round.title} for ${job.title} has been ${event.toLowerCase()}.`;
  const text = `Hello ${applicant.name},\n\n${introduction}${details ? `\n\n${details}` : ""}${round.meetingLink && event !== "Cancelled" ? `\n\n${actionLabel}: ${round.meetingLink}` : ""}\n\nBest regards, ${job.company || "WorkPath"} Recruitment Team`;
  await createTransporter().sendMail({ from: { name: `${job.company || "WorkPath"} Recruitment Team`, address: process.env.EMAIL_FROM }, to: applicant.email, subject, text, html: `<p>Hello ${escapeHtml(applicant.name)},</p><p>${escapeHtml(introduction)}</p>${details ? `<pre>${escapeHtml(details)}</pre>` : ""}${linkHtml}<p>Best regards,<br/>${escapeHtml(job.company || "WorkPath")} Recruitment Team</p>` });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

module.exports = {
  createVerificationToken,
  deliverVerificationEmail,
  sendApplicationSubmittedEmail,
  sendApplicationStatusEmail,
  sendRecruitmentUpdateEmail,
};
