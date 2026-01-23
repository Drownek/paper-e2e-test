package me.drownek.example.commands;

import com.cryptomorin.xseries.XMaterial;
import dev.rollczi.litecommands.LiteCommands;
import dev.rollczi.litecommands.annotations.argument.Arg;
import dev.rollczi.litecommands.annotations.async.Async;
import dev.rollczi.litecommands.annotations.command.Command;
import dev.rollczi.litecommands.annotations.context.Context;
import dev.rollczi.litecommands.annotations.execute.Execute;
import dev.rollczi.litecommands.annotations.permission.Permission;
import dev.triumphteam.gui.guis.Gui;
import dev.triumphteam.gui.guis.PaginatedGui;
import eu.okaeri.configs.OkaeriConfig;
import eu.okaeri.injector.OkaeriInjector;
import eu.okaeri.injector.annotation.Inject;
import me.drownek.example.config.Messages;
import me.drownek.example.config.PluginConfig;
import me.drownek.example.config.polymorphic.computer.Laptop;
import me.drownek.example.config.polymorphic.computer.Server;
import me.drownek.example.data.User;
import me.drownek.example.service.ExampleService;
import me.drownek.util.WaitingTask;
import me.drownek.util.gui.AmountSelectionGui;
import me.drownek.util.gui.GuiItemInfo;
import me.drownek.util.message.TextUtil;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.logging.Level;
import java.util.stream.Collectors;

@Command(name = "example")
@Permission("example")
public class ExampleCommand {

    private @Inject ExampleService exampleService;
    private @Inject OkaeriInjector injector;
    private @Inject Messages messages;
    private @Inject Plugin plugin;
    private @Inject PluginConfig config;

    @Execute(name = "polymorphic computer")
    void polymorphicComputer(@Context CommandSender commandSender) {
        config.computers.add(new Laptop("Apple", "MacBook Pro", 2499.99, 16, 1.4, 12, 512));
        config.computers.add(new Server("Dell", "PowerEdge R750", 4999.99, 64, 24, true));
        config.save();
        config.load();
        commandSender.sendMessage(
            config.computers.stream()
                .map(computer -> computer.getClass().getSimpleName())
                .collect(Collectors.joining(", "))
        );
    }

    @Async
    @Execute(name = "set-balance")
    void setBalance(@Context CommandSender player, @Arg User target, @Arg BigDecimal balance) {
        target.setBalance(balance);
        target.save();
        player.sendMessage("Balance set " + balance);
    }

    @Async
    @Execute(name = "get-balance")
    void getBalance(@Context CommandSender sender, @Arg User target) {
        sender.sendMessage("Balance: " + target.getBalance());
    }

    @Execute(name = "greeting")
    void execute(@Context CommandSender player) {
        exampleService.greet(player);
    }

    @Execute(name = "audible-message")
    void audibleMessage(@Context Player player) {
        messages.audibleMessage
            .with("%player%", player.getName())
            .sendTo(player);
    }

    @Execute(name = "gui-settings")
    void guiSettings(@Context Player player) {
        Gui gui = config.guiSettings.toGuiBuilder().disableAllInteractions().create();
        config.guiItemInfo
            .with("%placeholder%", player.getName())
            .setGuiItem(gui, event -> player.sendMessage("You clicked on item " + event.getSlot()));
        gui.open(player);
    }

    @Execute(name = "paginated-gui")
    void paginatedGui(@Context Player player) {
        PaginatedGui gui = config.paginatedGuiSettings.toPaginatedGuiBuilder().disableAllInteractions().create();
        config.guiItemInfo
            .with("%placeholder%", player.getName())
            .setGuiItem(gui, event -> player.sendMessage("You clicked on item " + event.getSlot()));
        gui.open(player);
    }

    @Execute(name = "confirmation-gui")
    void confirmationGui(@Context Player player) {
        config.confirmationGuiSettings
            .yesAction(() -> {
                player.sendMessage("Yes clicked");
                player.closeInventory();
            })
            .noAction(() -> {
                player.sendMessage("No clicked");
                player.closeInventory();
            })
            .open(player);
    }

    @Execute(name = "waiting-task")
    void waitingTask(@Context Player player) {
        WaitingTask.builder()
            .actionName("TEST")
            .duration(Duration.ofSeconds(5))
            .successAction(() -> player.sendMessage("!!!"))
            .build()
            .start(player);
    }

    @Execute(name = "data-item-stack")
    void dataItemStack(@Context Player player) {
        ItemStack itemStack = config.dataItemStack.with("%placeholder%", player.getName()).getItemStack();
        player.getInventory().addItem(itemStack);
    }

    @Execute(name = "amount-selection-gui")
    void withdrawDemo(@Context Player player, @Arg(value = "balance") int balance) {
        GuiItemInfo moneyDisplay = new GuiItemInfo(
            13,
            XMaterial.GOLD_INGOT,
            "&6&lWithdraw Money",
            Arrays.asList(
                "&7Withdraw from your bank account",
                "",
                "&fCurrent Balance: &a$" + balance,
                "&fWithdraw Amount: &e${VALUE}",
                "&fRemaining: &a${REMAINING}",
                "",
                "&7Shift-click for ±$1000",
                "&eClick to withdraw!"
            )
        );

        AmountSelectionGui.builder()
            .title("&8Bank Withdrawal")
            .displayItem(moneyDisplay)
            .initialValue(100)
            .minValue(1)
            .maxValue(balance)
            .increaseStep(100)
            .decreaseStep(100)
            .increaseStepShift(1000)
            .decreaseStepShift(1000)
            .rows(4)
            .additionalPlaceholders(integer -> Map.of("{REMAINING}", balance - integer))
            .onConfirm(amount -> {
                player.sendMessage(TextUtil.color("&aWithdrew &e$" + amount + " &afrom your account!"));
                // Add actual withdrawal logic here
            })
            .build()
            .open(player);
    }

    @Execute(name = "reload")
    void reload(@Context CommandSender player) {
        try {
            injector.streamOf(OkaeriConfig.class).forEach(OkaeriConfig::load);
            //noinspection unchecked
            injector.get("commands", LiteCommands.class).ifPresent(
                commands -> messages.liteCommandsConfig.apply(commands)
            );
            messages.configReloaded.sendTo(player);
        } catch (Exception e) {
            messages.configReloadFail.sendTo(player);
            plugin.getLogger().log(Level.SEVERE, "Failed to reload config", e);
        }
    }
}
