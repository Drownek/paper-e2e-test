package me.drownek.example;

import dev.rollczi.litecommands.LiteCommands;
import me.drownek.example.config.Messages;
import me.drownek.platform.bukkit.LightBukkitPlugin;
import me.drownek.platform.core.annotation.Scan;
import me.drownek.platform.core.plan.Planned;
import org.bukkit.command.CommandSender;

import static me.drownek.platform.core.plan.ExecutionPhase.POST_STARTUP;
import static me.drownek.platform.core.plan.ExecutionPhase.SHUTDOWN;

@Scan(deep = true, exclusions = "me.drownek.example.libs")
public class ExamplePlugin extends LightBukkitPlugin {

    @Planned(POST_STARTUP)
    void postStartup(
        Messages messages,
        LiteCommands<CommandSender> commands
    ) {
        // Applying customized LiteCommands messages from built-in config that have to be added somewhere to use it
        messages.liteCommandsConfig.apply(commands);
        log("Plugin loaded successfully!");
        // This will display message to the console if me.drownek.platform.core.annotation.DebugLogging annotation will be added to ExamplePlugin
        debug("Test debug");
    }

    @Planned(SHUTDOWN)
    void shutdown() {
        log("Plugin unloaded successfully!");
    }
}
